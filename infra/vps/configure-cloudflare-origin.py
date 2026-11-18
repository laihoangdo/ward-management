#!/usr/bin/env python3
"""Trust official Cloudflare proxies only; arm timed HTTP(S) rollback before origin lockdown."""
import datetime
import hashlib
import ipaddress
import http.client
import json
import os
from pathlib import Path
import subprocess
import socket
import ssl
import urllib.error
import urllib.request
import urllib.parse

ROOT=Path('/etc/police-management')
CONF=Path('/etc/nginx/conf.d/10-police-cloudflare-real-ip.conf')
MARKER=ROOT/'cloudflare-origin.json'

def check(value, message):
    if not value:
        raise RuntimeError(message)

def command(args):
    result=subprocess.run(args,capture_output=True,text=True)
    check(result.returncode==0,'Origin policy command failed; timed rollback remains armed')
    return result.stdout

def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'PoliceDeploymentPreflight/1.0'})
    try:
        return urllib.request.urlopen(request,timeout=25).read()
    except urllib.error.HTTPError as error:
        location=urllib.parse.urlsplit(url)
        raise RuntimeError('HTTP '+str(error.code)+' loading public dependency '+location.hostname+location.path) from None

def dns(kind):
    data=json.loads(fetch('https://dns.google/resolve?name=sunnytech.cloud&type='+kind))
    check(data.get('Status')==0,'DNS lookup failed')
    return [item['data'].rstrip('.').lower() for item in data.get('Answer',[]) if item.get('type')=={'NS':2,'A':1,'AAAA':28}[kind]]

def origin_check():
    # The owner must verify the public edge from an independent client before/after this script.
    # Origin self-requests may be challenged by Cloudflare IP/bot policy; do not bypass that policy.
    with socket.create_connection(('127.0.0.1',443),timeout=15) as raw:
        with ssl.create_default_context().wrap_socket(raw,server_hostname='sunnytech.cloud') as tls:
            tls.sendall(b'GET / HTTP/1.0\r\nHost: sunnytech.cloud\r\n\r\n')
            response=http.client.HTTPResponse(tls)
            response.begin()
            check(response.status==503,'Origin must remain in maintenance')
            check(b'Service temporarily unavailable.' in response.read(),'Expected origin response missing')

def run():
    check(os.geteuid()==0,'Run via sudo')
    check(not CONF.exists() and not MARKER.exists(),'Cloudflare policy exists; review instead of overwriting')
    networks=[]
    body=fetch('https://api.cloudflare.com/client/v4/ips')
    published=json.loads(body)
    check(published.get('success') is True,'Cloudflare public IP API rejected request')
    for version in [4,6]:
        rows=[ipaddress.ip_network(line,strict=True) for line in published['result']['ipv'+str(version)+'_cidrs']]
        check(5<=len(rows)<=60,'Unexpected Cloudflare range count')
        check(all(net.version==version and net.is_global and net.prefixlen>=8 for net in rows),'Unsafe proxy range')
        networks.extend(rows)
    check(set(dns('NS'))=={'adam.ns.cloudflare.com','jocelyn.ns.cloudflare.com'},'Nameserver ownership handover not proven')
    addresses=dns('A')+dns('AAAA')
    check(addresses and all(any(ipaddress.ip_address(address) in net for net in networks if net.version==ipaddress.ip_address(address).version) for address in addresses),'Public origin is not exclusively Cloudflare proxied')
    origin_check()
    checkpoint=Path('/root/police-deployment-checkpoints/cloudflare-origin')
    check(not checkpoint.exists(),'Checkpoint exists; review previous attempt')
    checkpoint.mkdir(mode=0o700)
    command(['tar','-cf',str(checkpoint/'ufw-before.tar'),'-C','/etc','ufw'])
    rollback=checkpoint/'rollback.sh'
    rollback.write_text('#!/usr/bin/env bash\nset -euo pipefail\nufw allow 80/tcp\nufw allow 443/tcp\n')
    rollback.chmod(0o700)
    command(['systemd-run','--unit=police-cloudflare-origin-rollback','--on-active=4m','--timer-property=AccuracySec=1s','/bin/bash',str(rollback)])
    CONF.write_text('# Official Cloudflare CIDRs; never trust arbitrary client forwarding headers.\n'+
        ''.join('set_real_ip_from '+str(net)+';\n' for net in networks)+
        'real_ip_header CF-Connecting-IP;\nreal_ip_recursive off;\n')
    CONF.chmod(0o644)
    command(['nginx','-t'])
    command(['systemctl','reload','nginx.service'])
    command(['ufw','allow','from','172.29.40.10','to','172.29.40.1','port','443','proto','tcp','comment','private backend OIDC discovery'])
    for net in networks:
        for port in ['80','443']:
            command(['ufw','allow','from',str(net),'to','any','port',port,'proto','tcp','comment','police Cloudflare origin'])
    command(['ufw','--force','delete','allow','80/tcp'])
    command(['ufw','--force','delete','allow','443/tcp'])
    origin_check()
    MARKER.write_text(json.dumps({'configuredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'sources':['https://api.cloudflare.com/client/v4/ips'],
        'ranges':[str(net) for net in networks],'sourceSha256':hashlib.sha256(body).hexdigest(),
        'confirmed':False}))
    MARKER.chmod(0o600)
    print('Cloudflare origin restrictions applied; timed rollback is ARMED. Verify external edge, fresh SSH and backend health, then stop police-cloudflare-origin-rollback.timer and mark confirmed.')

if __name__=='__main__':
    try:
        run()
    except Exception as error:
        print('CLOUDFLARE_ORIGIN_FAILED: '+str(error) if isinstance(error,RuntimeError) else 'CLOUDFLARE_ORIGIN_FAILED: '+type(error).__name__)
        raise SystemExit(1)
