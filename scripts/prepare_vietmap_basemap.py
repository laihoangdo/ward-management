"""Check the existing VietMap integration and cache an exactly georeferenced basemap."""
from vietmap_credentials import load_vietmap_api_key
import argparse
import hashlib
import io
import json
import math
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/vietmap'
RADIUS=6378137.0

def fetch(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'HCMC-Blender-local-project/1.0'}),timeout=30) as response:
            return response.status,response.read()
    except Exception as error:
        # Network exceptions can include credential-bearing URLs; never print them.
        raise RuntimeError('VietMap request failed: '+type(error).__name__) from None

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--zoom',type=int,default=16)
    ap.add_argument('--max-tiles',type=int,default=64)
    ap.add_argument('--refresh',action='store_true')
    args=ap.parse_args()
    if not 1<=args.zoom<=19:ap.error('zoom must be 1–19')
    key=load_vietmap_api_key(ROOT)
    status,raw=fetch('https://maps.vietmap.vn/api/maps/light/styles.json?apikey='+key)
    style=json.loads(raw)
    layers=sorted({layer.get('source-layer') for layer in style.get('layers',[]) if layer.get('source-layer')})
    processed=json.loads((ROOT/'data/hcmc_processed/dataset_manifest.json').read_text(encoding='utf-8'))
    boundary=json.loads(Path(processed['boundary']['path']).read_text(encoding='utf-8'))
    from shapely.geometry import shape
    from shapely.ops import unary_union
    extent=unary_union([shape(f['geometry']) for f in boundary['features'] if f['properties'].get('is_outer')])
    west,south,east,north=extent.bounds
    n=2**args.zoom
    def xy(lon,lat):return ((lon+180)/360*n,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
    x0,y0=map(math.floor,xy(west,north));x1,y1=map(math.floor,xy(east,south))
    count=(x1-x0+1)*(y1-y0+1)
    if count>args.max_tiles:ap.error(f'{count} tiles exceeds configured max-tiles; lower zoom or explicitly raise limit')
    OUT.mkdir(parents=True,exist_ok=True)
    downloaded=0;tile_size=None;canvas=None;tiles=[]
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            path=OUT/'tiles'/str(args.zoom)/str(x)/f'{y}.png'
            if args.refresh or not path.exists():
                _,data=fetch(f'https://maps.vietmap.vn/tm/{args.zoom}/{x}/{y}@2x.png?apikey='+key)
                image=Image.open(io.BytesIO(data));image.verify()
                path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);downloaded+=1
            with Image.open(path) as image:
                image=image.convert('RGB')
                if tile_size is None:
                    tile_size=image.size
                    canvas=Image.new('RGB',((x1-x0+1)*tile_size[0],(y1-y0+1)*tile_size[1]))
                if image.size!=tile_size:raise RuntimeError('Inconsistent tile dimensions')
                canvas.paste(image,((x-x0)*tile_size[0],(y-y0)*tile_size[1]))
            tiles.append({'z':args.zoom,'x':x,'y':y,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    image_path=OUT/'hcmc_vietmap_basemap.png';canvas.save(image_path)
    circumference=2*math.pi*RADIUS
    bounds=[x0/n*circumference-circumference/2,circumference/2-(y1+1)/n*circumference,(x1+1)/n*circumference-circumference/2,circumference/2-y0/n*circumference]
    metadata={'provider':'VIETMAP','attribution':'© VIETMAP','purpose':'Local Blender map display; OSM remains editable geometry source','checked_at_utc':datetime.now(timezone.utc).isoformat(),'style_http_status':status,'vector_source_layers':layers,'tile_endpoint_redacted':'https://maps.vietmap.vn/tm/{z}/{x}/{y}@2x.png?apikey=REDACTED','zoom':args.zoom,'tile_count':count,'downloaded_this_run':downloaded,'image':str(image_path.relative_to(ROOT)).replace('\\','/'),'image_sha256':hashlib.sha256(image_path.read_bytes()).hexdigest(),'image_size':list(canvas.size),'crs':'EPSG:3857','bounds':bounds,'xyz_tile_range':[x0,y0,x1,y1],'tiles':tiles,'licensing':'Existing account credentials used for local display. Account contract/export or redistribution rights have not been independently verified.','limitations':['Rendered basemap is not a DEM or authoritative administrative boundary.','Style layer presence does not establish complete editable footprint/height coverage.','Basemap and OSM source dates/alignments may differ.']}
    (OUT/'basemap_manifest.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in metadata.items() if k!='tiles'},ensure_ascii=True,indent=2))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Basemap preparation failed: '+str(error),file=sys.stderr)
        raise SystemExit(1)
