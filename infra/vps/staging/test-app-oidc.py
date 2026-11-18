#!/usr/bin/env python3
"""Actual deployed backend OIDC/session/RBAC gate. Synthetic identity disabled in finally."""
import importlib.util
import json
from pathlib import Path
import secrets
import urllib.error
import urllib.parse
import urllib.request

def module(name, filename):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(filename))
    loaded=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded

gate=module('mfa','test-mfa.py')
admin=module('admin','audit-and-close-gate.py')

def run():
    access=admin.request('/realms/master/protocol/openid-connect/token',method='POST',form=True,body={
        'grant_type':'password','client_id':'admin-cli','username':'staging-bootstrap',
        'password':(admin.ROOT/'keycloak_bootstrap').read_text()})['access_token']
    api='/admin/realms/police-staging'
    username='synthetic-app-gate-'+secrets.token_hex(5)
    password=secrets.token_urlsafe(32)
    admin.request(api+'/users',method='POST',token=access,body={'username':username,'enabled':True,
        'firstName':'Synthetic','lastName':'Application gate','email':username+'@example.invalid',
        'emailVerified':True,'requiredActions':['CONFIGURE_TOTP'],
        'credentials':[{'type':'password','value':password,'temporary':False}]})
    users=admin.request(api+'/users?username='+username+'&exact=true',token=access)
    gate.check(len(users)==1,'Synthetic account lookup failed')
    user_id=users[0]['id']
    try:
        role=admin.request(api+'/roles/ROLE_SUPERADMIN',token=access)
        admin.request(api+'/users/'+user_id+'/role-mappings/realm',method='POST',body=[role],token=access)
        session=gate.Session()
        status,_,html=session.request(gate.BASE+'/oauth2/authorization/oidc')
        if status != 200:
            categories=('invalid redirect','invalid parameter','forbidden','access denied','service temporarily unavailable')
            category=next((item for item in categories if item in html.lower()),'unclassified')
            path=urllib.parse.urlsplit(_).path
            raise gate.GateError('Application authorization redirect failed (HTTP '+str(status)+', path '+path+', '+category+')')
        status,url,html=gate.submit(session,gate.Forms(html).with_field('password'),{'username':username,'password':password})
        gate.no_code(url)
        form=gate.Forms(html).with_field('totpSecret')
        seed=form['fields']['totpSecret']
        status,_,_=gate.submit(session,form,{'totp':gate.otp(seed),'userLabel':'Synthetic app gate'})
        status,_,body=session.request(gate.BASE+'/api/rbac/me')
        gate.check(status==200,'Real backend RBAC/Keycloak admin TLS integration failed')
        me=json.loads(body)
        gate.check(me.get('id')==user_id and me.get('role')=='superadmin','Application returned wrong identity/role')
        status,_,body=session.request(gate.BASE+'/api/households')
        gate.check(status==200 and json.loads(body)==[],'Synthetic empty household API failed')
        for asset in ['/content/data/badiem-houses.geojson', '/content/assets/badiem_satellite/8/203/120.jpg', '/ocr/lang/vie.traineddata.gz']:
            try:
                response=session.opener.open(urllib.request.Request(gate.BASE+asset,method='HEAD'),timeout=25)
            except urllib.error.HTTPError as error:
                raise gate.GateError('Production resource '+asset+' returned HTTP '+str(error.code)) from None
            gate.check(response.status==200 and 'text/html' not in response.headers.get('Content-Type',''), 'Production map/raster/OCR resource missing')
        jar=next(handler.cookiejar for handler in session.opener.handlers if isinstance(handler,urllib.request.HTTPCookieProcessor))
        session_cookie=next(cookie for cookie in jar if cookie.name=='JSESSIONID')
        gate.check(session_cookie.secure and session_cookie.has_nonstandard_attr('HttpOnly'), 'Session cookie is not Secure/HttpOnly')
        csrf=next(cookie.value for cookie in jar if cookie.name=='XSRF-TOKEN')
        req=urllib.request.Request(gate.BASE+'/api/logout',method='POST',headers={'X-XSRF-TOKEN':urllib.parse.unquote(csrf),'Accept':'application/json'})
        response=session.opener.open(req,timeout=25)
        gate.check(response.status==200,'Application logout failed')
        logout=json.loads(response.read())
        gate.check(logout.get('logoutUrl','').startswith(gate.BASE+'/realms/police-staging/'),'Unexpected global logout URL')
        session.request(logout['logoutUrl'])
        gate.check(session.request(gate.BASE+'/api/rbac/me')[0]==401,'Application session survived logout')
        print(json.dumps({'result':'PASS','actual_backend_oidc':True,'required_mfa':True,
            'real_rbac_and_internal_admin_tls':True,'empty_household_api':True,'csrf_logout':True,
            'application_session_revoked':True,'secure_http_only_session':True,'map_raster_ocr_resources':True,'frontend_public':False}))
    finally:
        admin.request(api+'/users/'+user_id+'/logout',method='POST',token=access)
        admin.request(api+'/users/'+user_id,method='PUT',body={'enabled':False},token=access)

if __name__=='__main__':
    try:
        run()
    except gate.GateError as error:
        print('APP_OIDC_GATE_FAILED: '+str(error))
        raise SystemExit(1)
    except Exception as error:
        print('APP_OIDC_GATE_FAILED: '+type(error).__name__)
        raise SystemExit(1)
