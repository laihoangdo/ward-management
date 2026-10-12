"""Cache all current VietMap SDK source layers over the supplied geographic extent.

Uses the official SDK's public querySourceFeatures API; never reverse engineers
the provider's binary transport. Preserves tile provenance and missing IDs.
"""
from vietmap_credentials import load_vietmap_api_key
import argparse
import hashlib
import json
import math
import os
import re
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from shapely.geometry import shape,box,mapping
from shapely.ops import transform,unary_union
from shapely import make_valid
from pyproj import Transformer
from prepare_hcmc_gis import parts,write

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/vietmap/vector_sources'

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--refresh',action='store_true');ap.add_argument('--config',type=Path,default=ROOT/'config/ba_diem_3d.json');args=ap.parse_args()
    config=json.loads(args.config.read_text(encoding='utf-8'))
    if config['detail_zoom_increment'] not in (4,5):
        ap.error('detail_zoom_increment must be 4 or 5')
    key=load_vietmap_api_key(ROOT)
    boundary_doc=json.loads((ROOT/config['boundary_file']).read_text(encoding='utf-8'))
    boundary=unary_union([shape(f['geometry']) for f in boundary_doc['features'] if f['properties'].get('is_outer')])
    west,south,east,north=boundary.bounds
    requested_zoom=config['source_default_zoom']+config['detail_zoom_increment']
    z=min(requested_zoom,config['source_native_max_zoom']);n=2**z
    def tilexy(lon,lat):return ((lon+180)/360*n,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
    def lnglat(x,y):return (x/n*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n)))))
    x0,y0=map(math.floor,tilexy(west,north));x1,y1=map(math.floor,tilexy(east,south))
    selected_tiles=[]
    for x in range(x0,x1+1):
        for y in range(y0,y1+1):
            w,nn=lnglat(x,y);ee,ss=lnglat(x+1,y+1)
            if boundary.intersects(box(w,ss,ee,nn)):
                selected_tiles.append((x,y))
    print(f'Requested zoom {requested_zoom}; native maximum {config["source_native_max_zoom"]}; effective zoom {z}; intersecting tiles {len(selected_tiles)}',flush=True)
    downloads=[];source_info=None
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':512,'height':512})
        page.set_content('<html><body style="margin:0"><div id="map" style="width:512px;height:512px"></div></body></html>')
        page.add_script_tag(url='https://unpkg.com/@vietmap/vietmap-gl-js@6.0.1/dist/vietmap-gl.js')
        source_info=page.evaluate('''async key=>{
          window.vectorMap=new vietmapgl.Map({container:'map',style:'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey='+key,center:[106.611,10.8525],zoom:15,attributionControl:false});
          window.sdkErrors=[];vectorMap.on('error',e=>sdkErrors.push(String(e.error?.message||'SDK error').replaceAll(key,'REDACTED')));
          await new Promise((resolve,reject)=>{vectorMap.once('idle',resolve);setTimeout(()=>reject(new Error('SDK idle timeout')),45000)});
          return JSON.parse(JSON.stringify(vectorMap.getStyle().sources).replaceAll(key,'REDACTED'));
        }''',key)
        actual_max=source_info.get('openmaptiles',{}).get('maxzoom')
        if actual_max is None or int(actual_max)!=config['source_native_max_zoom']:
            raise RuntimeError(f'Vector maxzoom changed (current {actual_max}); update config and rerun to avoid incorrect coverage')
        source_version_hash=hashlib.sha256(json.dumps(source_info,sort_keys=True).encode()).hexdigest()[:16]
        for x,y in selected_tiles:
                path=ROOT/f'data/vietmap/sdk_tiles/{source_version_hash}/{z}/{x}/{y}.json'
                if not args.refresh and path.exists():
                    result=json.loads(path.read_text(encoding='utf-8'))
                else:
                    result=page.evaluate('''async center=>{
                      vectorMap.jumpTo({center,zoom:%d});
                      await new Promise((resolve,reject)=>{vectorMap.once('idle',resolve);setTimeout(()=>reject(new Error('SDK tile idle timeout')),45000)});
                      const layers=[...new Set(vectorMap.getStyle().layers.map(l=>l['source-layer']).filter(Boolean))];
                      const features={};for(const layer of layers)features[layer]=vectorMap.querySourceFeatures('openmaptiles',{sourceLayer:layer}).map(f=>({type:'Feature',id:f.id,geometry:f.geometry,properties:f.properties}));
                      return {errors:sdkErrors,features};
                    }''' % z,list(lnglat(x+.5,y+.5)))
                    if result['errors']:raise RuntimeError('SDK reported errors; see audit rather than generating incomplete data')
                    write(path,result)
                downloads.append((x,y,path,result))
                print(f'Vector tile {z}/{x}/{y}: '+str({k:len(v) for k,v in result['features'].items()}),flush=True)
        # Capture the current official style as an exactly framed ground texture.
        # This replaces the older raster endpoint, keeping imagery and features on the same source version.
        width,height=(x1-x0+1)*512,(y1-y0+1)*512
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate('''async args=>{
          const container=document.getElementById('map');container.style.width=args.width+'px';container.style.height=args.height+'px';
          vectorMap.resize();vectorMap.jumpTo({center:args.center,zoom:%d,bearing:0,pitch:0});
          await new Promise((resolve,reject)=>{vectorMap.once('idle',resolve);setTimeout(()=>reject(new Error('SDK basemap timeout')),45000)});
        }''' % z,{'width':width,'height':height,'center':list(lnglat((x0+x1+1)/2,(y0+y1+1)/2))})
        image_path=ROOT/'data/vietmap/hcmc_vietmap_basemap.png'
        page.locator('#map').screenshot(path=str(image_path))
        circumference=2*math.pi*6378137
        bounds=[x0/n*circumference-circumference/2,circumference/2-(y1+1)/n*circumference,(x1+1)/n*circumference-circumference/2,circumference/2-y0/n*circumference]
        write(ROOT/'data/vietmap/basemap_manifest.json',{'provider':'VIETMAP','attribution':'© VIETMAP','purpose':'Current official SDK style ground map; all active features also from VIETMAP','checked_at_utc':datetime.now(timezone.utc).isoformat(),'style_http_status':200,'style_url_redacted':'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=REDACTED','source_info':source_info,'zoom':z,'requested_zoom':requested_zoom,'configured_native_max_zoom':config['source_native_max_zoom'],'boundary_file':config['boundary_file'],'tile_count':len(downloads),'image':'data/vietmap/hcmc_vietmap_basemap.png','image_sha256':hashlib.sha256(image_path.read_bytes()).hexdigest(),'image_size':[width,height],'crs':'EPSG:3857','bounds':bounds,'xyz_tile_range':[x0,y0,x1,y1],'capture_method':'official SDK, pitch 0, bearing 0, device pixel ratio 1, exact 512 pixels per XYZ cell','licensing':'Existing account access used; no independently verified redistribution terms.'})
        browser.close()
    by_layer={};seen=set();failures=[];counts=Counter()
    to_metric=Transformer.from_crs(4326,32648,always_xy=True).transform
    for x,y,path,result in downloads:
        w,nn=lnglat(x,y);ee,ss=lnglat(x+1,y+1)
        tile_extent=box(w,ss,ee,nn).intersection(boundary)
        for layer,features in result['features'].items():
            by_layer.setdefault(layer,[])
            for feature in features:
                counts[layer+'_input']+=1
                try:
                    geom=make_valid(shape(feature['geometry'])).intersection(tile_extent)
                    if geom.is_empty:continue
                    gt=geom.geom_type
                    component_type='Polygon' if 'Polygon' in gt else 'LineString' if 'LineString' in gt else 'Point' if 'Point' in gt else None
                    if gt=='GeometryCollection':
                        component_type=next((k for k in ('Polygon','LineString','Point') if list(parts(geom,k))),None)
                        counts[layer+'_clipped_contact_dimensions_reduced']+=1
                    if component_type is None:
                        failures.append({'layer':layer,'tile':[x,y],'reason':'unsupported geometry '+gt});continue
                    for component in parts(geom,component_type):
                        if component_type=='Point' and not (w<=component.x<ee and ss<component.y<=nn):continue
                        signature=hashlib.sha256((layer+json.dumps(feature['properties'],sort_keys=True)+component.normalize().wkb_hex).encode()).hexdigest()
                        if signature in seen:counts[layer+'_duplicates']+=1;continue
                        seen.add(signature)
                        record={'type':'Feature','geometry':mapping(component),'properties':{'source':'VIETMAP','source_id':f'vietmap-{layer}-{signature[:20]}','provider_feature_id':feature.get('id'),'provider_properties':feature['properties'],'source_tile':[z,x,y],'identity_basis':'tile_geometry_attribute_hash; provider feature ID missing' if feature.get('id') is None else 'provider feature ID and geometry hash'}}
                        by_layer[layer].append(record)
                except Exception as e:failures.append({'layer':layer,'tile':[x,y],'reason':str(e)})
    # Rejoin polygon fragments only across distinct source tiles, never simply all touching houses.
    from shapely.strtree import STRtree
    seam_merges=0
    for layer in ['building','water','landuse']:
        fs=by_layer.get(layer,[]);geos=[transform(to_metric,shape(f['geometry'])) for f in fs]
        tree=STRtree(geos);parents=list(range(len(fs)))
        def root(i):
            while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
            return i
        for i,g in enumerate(geos):
            for j in tree.query(g,predicate='intersects'):
                j=int(j)
                if j<=i or fs[i]['properties']['source_tile']==fs[j]['properties']['source_tile'] or fs[i]['properties']['provider_properties']!=fs[j]['properties']['provider_properties']:continue
                shared=g.intersection(geos[j])
                if shared.area>.001 or shared.length>.05:parents[root(j)]=root(i);seam_merges+=1
        groups={}
        for i,f in enumerate(fs):groups.setdefault(root(i),[]).append(f)
        merged=[]
        for group in groups.values():
            f=group[0].copy();f['properties']=dict(f['properties'])
            if len(group)>1:
                g=unary_union([shape(part['geometry']) for part in group]);f['geometry']=mapping(g)
                f['properties']['source_tiles']=[p['properties']['source_tile'] for p in group]
                f['properties']['fragment_join_estimated']=True
                f['properties']['source_id']='vietmap-'+layer+'-'+hashlib.sha256(g.normalize().wkb).hexdigest()[:20]
            merged.append(f)
        by_layer[layer]=merged
    for layer,fs in by_layer.items():write(OUT/f'{layer}.geojson',{'type':'FeatureCollection','features':fs})
    audit={'provider':'VIETMAP','style_url_redacted':'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=REDACTED','source_info':source_info,'queried_at_utc':datetime.now(timezone.utc).isoformat(),'zoom':z,'requested_zoom':requested_zoom,'configured_native_max_zoom':config['source_native_max_zoom'],'boundary_file':config['boundary_file'],'boundary_status':config['boundary_status'],'sdk':'@vietmap/vietmap-gl-js@6.0.1','tile_count':len(downloads),'counts':{k:len(fs) for k,fs in by_layer.items()},'input_counts':dict(counts),'failures':failures,'polygon_seam_joins':seam_merges,'tile_snapshots':[{'path':str(p.relative_to(ROOT)), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for x,y,p,result in downloads],'limitations':['All features provided by visible current-style source layers are cached; style-invisible layers are not discoverable by this query.', 'Missing provider IDs use geometry/attribute-derived identifiers.', 'Cross-tile polygon joins are inferred from shared boundaries and equal attributes.', 'A tile source version date does not establish current legal boundary status or height completeness.']}
    write(OUT/'vector_manifest.json',audit);print(json.dumps(audit['counts'],indent=2))

if __name__=='__main__':main()
