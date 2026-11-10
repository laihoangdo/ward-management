#!/usr/bin/env bash
# After the owner provisions GCS/IAM/scopes. Upload encrypted archives only; never keys/plain dumps.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || exit 1
input=${1:?Pass an explicit encrypted staging backup}
file=$(realpath "$input")
[[ "$file" =~ ^/var/backups/police-management/staging-[0-9]{8}T[0-9]{6}Z\.tar\.gz\.gpg$ ]] || {
    printf '%s\n' 'Only an owned encrypted staging backup path is allowed.' >&2; exit 1;
}
test -s "$file"
test -s "$file.sha256"
sha256sum --check --status "$file.sha256"
bucket=gs://sunnytech-backups-194646196669
project=project-c5680fe1-4087-4ff9-829
name=$(basename "$file")
upload_id=$(python3 -c 'import uuid; print(uuid.uuid4().hex)')
base=${name%.tar.gz.gpg}
remote_object="staging/${base}-${upload_id}.tar.gz.gpg"
destination="$bucket/$remote_object"
# Use the resumable JSON API directly. `gcloud storage cp` probes object metadata
# and needs storage.objects.get; this VM intentionally has create-only access.
upload_one() {
    GCS_BUCKET=${bucket#gs://} GCS_OBJECT="$2" BACKUP_FILE="$1" EXPECTED_PROJECT="$project" python3 - <<'PY'
import datetime,json,os,sys,http.client,urllib.error,urllib.parse,urllib.request
metadata='http://metadata.google.internal/computeMetadata/v1/'
def metadata_value(path):
    request=urllib.request.Request(metadata+path,headers={'Metadata-Flavor':'Google'})
    with urllib.request.urlopen(request,timeout=10) as response:
        return response.read().decode()
try:
    project=metadata_value('project/project-id')
    if project != os.environ['EXPECTED_PROJECT']:
        raise RuntimeError()
    token=json.loads(metadata_value('instance/service-accounts/default/token'))['access_token']
    bucket=os.environ['GCS_BUCKET']
    object_name=os.environ['GCS_OBJECT']
    file_path=os.environ['BACKUP_FILE']
    size=os.path.getsize(file_path)
    query=urllib.parse.urlencode({'uploadType':'resumable','name':object_name})
    url=f'https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?{query}'
    request=urllib.request.Request(url,data=b'{}',method='POST',headers={
        'Authorization':'Bearer '+token,
        'Content-Type':'application/json; charset=UTF-8',
        'X-Upload-Content-Type':'application/octet-stream',
        'X-Upload-Content-Length':str(size),
    })
    try:
        response=urllib.request.urlopen(request,timeout=30)
    except urllib.error.HTTPError as error:
        print(f'GCS resumable upload initiation rejected (HTTP {error.code}).',file=sys.stderr)
        raise SystemExit(1)
    with response:
        session=response.headers.get('Location')
    parsed=urllib.parse.urlsplit(session or '')
    if parsed.scheme!='https' or parsed.hostname!='storage.googleapis.com' or not parsed.path.startswith('/upload/storage/v1/'):
        raise RuntimeError()
    connection=http.client.HTTPSConnection(parsed.hostname,timeout=120)
    connection.putrequest('PUT',parsed.path+('?' + parsed.query if parsed.query else ''))
    connection.putheader('Authorization','Bearer '+token)
    connection.putheader('Content-Type','application/octet-stream')
    connection.putheader('Content-Length',str(size))
    connection.putheader('Content-Range',f'bytes 0-{size-1}/{size}')
    connection.endheaders()
    with open(file_path,'rb') as source:
        while chunk:=source.read(8*1024*1024):
            connection.send(chunk)
    result=connection.getresponse()
    body=result.read()
    connection.close()
    if result.status not in (200,201):
        print(f'GCS object creation rejected (HTTP {result.status}).',file=sys.stderr)
        raise SystemExit(1)
    obj=json.loads(body)
    if obj.get('bucket')!=bucket or obj.get('name')!=object_name or int(obj.get('size','-1'))!=size:
        raise RuntimeError()
except SystemExit:
    raise
except Exception:
    # Do not include exception text: resumable session URLs and credentials
    # must never enter terminal output or logs.
    print('GCS upload failed; no token or session URL was emitted.',file=sys.stderr)
    raise SystemExit(1)
PY
}
upload_one "$file" "$remote_object"
upload_one "$file.sha256" "$remote_object.sha256"
install -d -m 0700 /var/lib/police-management
BACKUP_OBJECT="$destination" python3 - <<'PY'
import datetime,json,os
from pathlib import Path
root=Path('/var/lib/police-management')
temporary=root/'last-gcs-upload.json.partial'
with temporary.open('w') as stream:
    json.dump({'result':'SUCCESS','scope':'synthetic-staging','object':os.environ['BACKUP_OBJECT'],
               'uploadedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},stream)
temporary.chmod(0o600)
temporary.replace(root/'last-gcs-upload.json')
PY
printf '%s\n' 'PASS: encrypted archive and checksum uploaded; a separate owner must verify GCS retrieval/restore.'
