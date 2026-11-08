#!/usr/bin/env python3
"""Create-only offsite copy of explicit encrypted operational source snapshots; never plaintext."""
import datetime as dt
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request
import uuid


def run(file):
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    file = file.resolve(strict=True)
    if file.parent != Path('/var/backups/police-management/migration-source') or not re.fullmatch(r'(source|identity)-[0-9]{8}T[0-9]{6}Z\.tar\.gz\.gpg', file.name):
        raise RuntimeError('Only explicit encrypted migration snapshots allowed')
    expected = Path(str(file) + '.sha256').read_text().split()[0]
    with file.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != expected:
            raise RuntimeError('Checksum mismatch')
    def metadata(path):
        request = urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/' + path, headers={'Metadata-Flavor': 'Google'})
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.read().decode()
    if metadata('project/project-id') != 'project-c5680fe1-4087-4ff9-829':
        raise RuntimeError('Unexpected project')
    token = json.loads(metadata('instance/service-accounts/default/token'))['access_token']
    bucket = 'sunnytech-backups-194646196669'
    name = 'migration-source/' + file.name.removesuffix('.tar.gz.gpg') + '-' + uuid.uuid4().hex + '.tar.gz.gpg'
    def upload(source, object_name):
        size = source.stat().st_size
        query = urllib.parse.urlencode({'uploadType': 'resumable', 'name': object_name})
        request = urllib.request.Request('https://storage.googleapis.com/upload/storage/v1/b/' + bucket + '/o?' + query,
            data=b'{}', method='POST', headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
            'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': str(size)})
        with urllib.request.urlopen(request, timeout=30) as response:
            url = urllib.parse.urlsplit(response.headers['Location'])
        if url.scheme != 'https' or url.hostname != 'storage.googleapis.com' or not url.path.startswith('/upload/storage/v1/'):
            raise RuntimeError('Unexpected upload endpoint')
        connection = http.client.HTTPSConnection(url.hostname, timeout=120)
        try:
            connection.putrequest('PUT', url.path + '?' + url.query)
            connection.putheader('Authorization', 'Bearer ' + token)
            connection.putheader('Content-Type', 'application/octet-stream')
            connection.putheader('Content-Length', str(size))
            connection.putheader('Content-Range', f'bytes 0-{size-1}/{size}')
            connection.endheaders()
            with source.open('rb') as stream:
                while block := stream.read(8 * 1024**2):
                    connection.send(block)
            response = connection.getresponse()
            body = response.read()
            if response.status not in (200, 201):
                raise RuntimeError('Object upload rejected')
            obj = json.loads(body)
            if obj.get('bucket') != bucket or obj.get('name') != object_name or int(obj.get('size', -1)) != size:
                raise RuntimeError('Upload acknowledgement mismatch')
        finally:
            connection.close()
    upload(file, name)
    upload(Path(str(file) + '.sha256'), name + '.sha256')
    receipt = {'result': 'SUCCESS', 'scope': 'operational-source-encrypted', 'object': 'gs://' + bucket + '/' + name,
               'sha256': expected, 'uploadedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
    directory = Path('/var/lib/police-management/migration-source')
    directory.mkdir(mode=0o700, exist_ok=True)
    target = directory / (file.name + '.receipt.json')
    with target.open('x') as stream:
        json.dump(receipt, stream)
    target.chmod(0o600)
    print(json.dumps(receipt))


if __name__ == '__main__':
    try:
        os.umask(0o077)
        if len(sys.argv) != 2:
            raise RuntimeError('One explicit archive required')
        run(Path(sys.argv[1]))
    except Exception:
        print('FAIL: migration-source upload; private output suppressed. Inspect receipts before retrying.', file=sys.stderr)
        sys.exit(1)
