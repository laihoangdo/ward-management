"""Inspect latest authenticated VietMap data using its official SDK public query API."""
from vietmap_credentials import load_vietmap_api_key
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
key=load_vietmap_api_key(ROOT)
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1024,'height':1024})
    page.set_content('<html><body style="margin:0"><div id="map" style="width:1024px;height:1024px"></div></body></html>')
    page.add_script_tag(url='https://unpkg.com/@vietmap/vietmap-gl-js@6.0.1/dist/vietmap-gl.js')
    result=page.evaluate('''async key => {
      const map = new vietmapgl.Map({container:'map', style:'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey='+key, center:[106.611,10.8525],zoom:15,attributionControl:false});
      window.inspectionMap=map;
      const errors=[];map.on('error',e=>errors.push(String(e.error?.message||'SDK error').replaceAll(key,'REDACTED')));
      await new Promise((resolve,reject)=>{map.once('idle',resolve);setTimeout(()=>reject(new Error('SDK idle timeout')),45000)});
      const layers=[...new Set(map.getStyle().layers.map(l=>l['source-layer']).filter(Boolean))];
      const features={};for(const layer of layers)features[layer]=map.querySourceFeatures('openmaptiles',{sourceLayer:layer}).map(f=>f.toJSON());
      return {errors,features};
    }''',key)
    out=ROOT/'data/vietmap/sdk_sample_features.json'
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'errors':result['errors'],'layers':{k:{'count':len(fs),'sample':[f.get('properties') for f in fs[:2]],'ids':[f.get('id') for f in fs[:2]]} for k,fs in result['features'].items()}},ensure_ascii=True,indent=2))
    page.screenshot(path=str(ROOT/'data/vietmap/sdk_sample.png'))
    browser.close()
