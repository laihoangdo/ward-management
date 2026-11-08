#!/usr/bin/env python3
"""Owner-run Cloud Shell setup: 90-day Singapore audit bucket, email and alert policies.

Creates scoped resources, never changes default sinks or locks retention.
"""
import json
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

PROJECT = 'project-c5680fe1-4087-4ff9-829'
EMAIL = 'laihoangdo0506@gmail.com'
LOCATION = 'asia-southeast1'
BUCKET = 'police-audit-90d'


def command(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Cloud CLI prerequisite failed; check owner permissions')
    return result.stdout.strip()


def run():
    actor = command(['gcloud', 'auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'])
    if not actor or actor.endswith('gserviceaccount.com'):
        raise RuntimeError('Use authorized human owner account')
    instance = json.loads(command(['gcloud', 'compute', 'instances', 'describe', 'instance-household',
        '--zone=asia-southeast1-a', '--project=' + PROJECT, '--format=json(id,networkInterfaces)']))
    if instance['networkInterfaces'][0]['networkIP'] != '10.148.0.3':
        raise RuntimeError('VM identity mismatch')
    instance_id = str(instance['id'])
    if input('Create 90-day audit storage and alerts (billable); type APPROVE-90-DAYS: ') != 'APPROVE-90-DAYS':
        raise RuntimeError('Not approved')
    command(['gcloud', 'services', 'enable', 'logging.googleapis.com', 'monitoring.googleapis.com', '--project=' + PROJECT])
    token = command(['gcloud', 'auth', 'print-access-token'])

    def api(host, path, method='GET', body=None, missing=False):
        request = urllib.request.Request('https://' + host + path,
            data=None if body is None else json.dumps(body).encode(), method=method,
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if missing and error.code == 404:
                return None
            raise RuntimeError('Cloud API rejected request: HTTP ' + str(error.code)) from None

    base = '/v2/projects/' + PROJECT
    bucket_path = base + '/locations/' + LOCATION + '/buckets/' + BUCKET
    bucket = api('logging.googleapis.com', bucket_path, missing=True)
    if bucket is None:
        api('logging.googleapis.com', base + '/locations/' + LOCATION + '/buckets?bucketId=' + BUCKET,
            'POST', {'description': 'Minimized police application audit and operations; owner approved 90 days', 'retentionDays': 90})
    elif bucket.get('retentionDays') != 90 or bucket.get('locked', False):
        raise RuntimeError('Existing audit bucket retention/lock differs; manual review required')
    log_filter = ('resource.type="gce_instance" AND resource.labels.instance_id="' + instance_id + '" AND '
                  '(log_id("police-rbac-audit") OR log_id("police-ops-health") OR log_id("police-deployment-check"))')
    destination = 'logging.googleapis.com/projects/' + PROJECT + '/locations/' + LOCATION + '/buckets/' + BUCKET
    sink_path = base + '/sinks/police-audit-90d'
    sink = api('logging.googleapis.com', sink_path, missing=True)
    if sink is None:
        api('logging.googleapis.com', base + '/sinks', 'POST',
            {'name': 'police-audit-90d', 'destination': destination, 'filter': log_filter})
    elif sink.get('destination') != destination or sink.get('filter') != log_filter or sink.get('disabled', False):
        raise RuntimeError('Existing audit sink differs; manual review required')
    print('PASS: dedicated 90-day audit bucket and VM-scoped sink configured; retention not locked.')

    monitoring = '/v3/projects/' + PROJECT
    channels = api('monitoring.googleapis.com', monitoring + '/notificationChannels').get('notificationChannels', [])
    matching = [c for c in channels if c.get('displayName') == 'Police owner operations' and
                c.get('type') == 'email' and c.get('labels', {}).get('email_address') == EMAIL]
    if len(matching) > 1:
        raise RuntimeError('Duplicate owner notification channels; review manually')
    channel = matching[0] if matching else api('monitoring.googleapis.com', monitoring + '/notificationChannels', 'POST',
        {'type': 'email', 'displayName': 'Police owner operations', 'labels': {'email_address': EMAIL}, 'enabled': True})
    if channel.get('enabled') is False:
        raise RuntimeError('Owner notification channel is disabled')

    heartbeat_filter = log_filter + ' AND log_id("police-ops-health") AND jsonPayload.event="operations_heartbeat"'
    metric = api('logging.googleapis.com', base + '/metrics/police_ops_heartbeat', missing=True)
    if metric is None:
        api('logging.googleapis.com', base + '/metrics', 'POST',
            {'name': 'police_ops_heartbeat', 'filter': heartbeat_filter,
             'metricDescriptor': {'metricKind': 'DELTA', 'valueType': 'INT64', 'unit': '1'}})
    elif metric.get('filter') != heartbeat_filter or metric.get('disabled', False):
        raise RuntimeError('Existing heartbeat metric differs; manual review required')

    policy_base = {'enabled': True, 'combiner': 'OR', 'notificationChannels': [channel['name']],
                   'documentation': {'mimeType': 'text/markdown', 'content':
                       'Check VPN access, staging/app health, backup upload age and audit exporter. '
                       'Never paste credentials, citizen records or raw audit details into notifications. '
                       'Public root intentionally returns 503 until owner cutover approval.'}}
    policies = [
        {'displayName': 'Police operations failure or alert test', 'conditions': [{
            'displayName': 'Unhealthy app, stale backup, low disk or synthetic alert test',
            'conditionMatchedLog': {'filter': log_filter + ' AND log_id("police-ops-health") AND '
                                    '(jsonPayload.unhealthy=true OR jsonPayload.alertTest=true)'}}],
         'alertStrategy': {'notificationRateLimit': {'period': '300s'}, 'autoClose': '1800s'}},
        {'displayName': 'Police audit risk signal', 'conditions': [{
            'displayName': 'Denied/failed operation or identity reveal in mirrored RBAC audit',
            'conditionMatchedLog': {'filter': log_filter + ' AND log_id("police-rbac-audit") AND jsonPayload.riskSignal=true'}}],
         'alertStrategy': {'notificationRateLimit': {'period': '300s'}, 'autoClose': '1800s'}},
        {'displayName': 'Police audit exporter heartbeat missing', 'conditions': [{
            'displayName': 'No exporter heartbeat for ten minutes',
            'conditionAbsent': {'filter': 'resource.type="gce_instance" AND resource.label.instance_id="' + instance_id +
                '" AND metric.type="logging.googleapis.com/user/police_ops_heartbeat"', 'duration': '600s',
                'aggregations': [{'alignmentPeriod': '120s', 'perSeriesAligner': 'ALIGN_DELTA'}],
                'trigger': {'count': 1}}}], 'alertStrategy': {'autoClose': '1800s'}},
    ]
    existing = api('monitoring.googleapis.com', monitoring + '/alertPolicies').get('alertPolicies', [])
    for spec in policies:
        matches = [p for p in existing if p.get('displayName') == spec['displayName']]
        if matches:
            print('REVIEW existing policy (not overwritten): ' + spec['displayName'])
            if len(matches) != 1 or not matches[0].get('enabled') or channel['name'] not in matches[0].get('notificationChannels', []):
                raise RuntimeError('Existing alert policy requires manual review')
        else:
            api('monitoring.googleapis.com', monitoring + '/alertPolicies', 'POST', dict(policy_base, **spec))
            print('CREATED: ' + spec['displayName'])
    print('Configured channel: ' + channel['name'])
    print('NEXT: deploy exporter; verify audit read-back in the dedicated bucket; trigger test and confirm actual email receipt.')
    print('NOT PASS YET: creation alone does not prove delivery, retention routing or full audit coverage.')


if __name__ == '__main__':
    try:
        run()
    except (Exception, KeyboardInterrupt) as error:
        print('SETUP STOPPED: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        print('Existing resources were not deleted; inspect before retrying.', file=sys.stderr)
        sys.exit(1)
