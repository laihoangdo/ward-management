#!/usr/bin/env python3
"""Synthetic write-only cloud logging probe. Never prints the metadata access token."""
import datetime
import json
import os
import urllib.request
import urllib.error

def metadata(path):
    request=urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/'+path,
        headers={'Metadata-Flavor':'Google'})
    return urllib.request.urlopen(request,timeout=10).read().decode()

def run():
    if os.geteuid()!=0:
        raise RuntimeError('Run via sudo')
    project=metadata('project/project-id')
    if project!='project-c5680fe1-4087-4ff9-829':
        raise RuntimeError('Unexpected project')
    token=json.loads(metadata('instance/service-accounts/default/token'))['access_token']
    entry={'logName':'projects/'+project+'/logs/police-deployment-check',
        'resource':{'type':'gce_instance','labels':{'project_id':project,'instance_id':metadata('instance/id'),
            'zone':metadata('instance/zone').split('/')[-1]}},
        'severity':'NOTICE','jsonPayload':{'event':'synthetic_logging_write_probe','containsCitizenData':False},
        'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    request=urllib.request.Request('https://logging.googleapis.com/v2/entries:write',
        data=json.dumps({'entries':[entry]}).encode(),
        headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST')
    response=urllib.request.urlopen(request,timeout=25)
    if response.status!=200:
        raise RuntimeError('Cloud write rejected')
    print('PASS: synthetic cloud log write accepted. This is not proof of application audit coverage, read-back or immutable retention.')

if __name__=='__main__':
    try:
        run()
    except urllib.error.HTTPError as error:
        try:
            detail=json.loads(error.read()).get('error',{})
            reasons=[item.get('reason') for item in detail.get('details',[]) if item.get('reason')]
            print(json.dumps({'cloud_log_probe':'FAILED','http':error.code,'status':detail.get('status'),'reasons':reasons}))
        except Exception:
            print('CLOUD_LOG_PROBE_FAILED: HTTP '+str(error.code))
        raise SystemExit(1)
    except Exception as error:
        print('CLOUD_LOG_PROBE_FAILED: '+type(error).__name__)
        raise SystemExit(1)
