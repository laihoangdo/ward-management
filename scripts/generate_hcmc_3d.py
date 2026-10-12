"""Generate independent tile libraries and a linked editable geographic master scene."""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from shapely.geometry import shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
sys.path.insert(0, str(ROOT))
from hcmc_road_names import embedded_name
from generate_ba_diem_3d import append_bmesh_faces

DATA = ROOT/'data/hcmc_processed'
ASSETS = ROOT/'data/hcmc_assets'
VERSION = '4-post-merger-boundary'

def read(p):
    return json.loads(p.read_text(encoding='utf-8'))

def material(name, color, paint_distance=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color,1)
    shader.inputs['Roughness'].default_value = .9
    if paint_distance:
        nodes, links = m.node_tree.nodes, m.node_tree.links
        cam = nodes.new('ShaderNodeCameraData')
        test = nodes.new('ShaderNodeMath'); test.operation='LESS_THAN'
        test.inputs[1].default_value = paint_distance
        mix = nodes.new('ShaderNodeMixRGB')
        mix.inputs[1].default_value = (.12,.13,.14,1)
        mix.inputs[2].default_value = (*color,1)
        links.new(cam.outputs['View Distance'], test.inputs[0])
        links.new(test.outputs[0], mix.inputs[0])
        links.new(mix.outputs[0],shader.inputs['Base Color'])
    return m

def object_mesh(name, verts, faces, collection, mat, position=(0,0,0), props=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces); mesh.update()
    obj = bpy.data.objects.new(name,mesh); collection.objects.link(obj)
    obj.location = position; obj.data.materials.append(mat)
    if props:
        obj['source_attributes_json'] = json.dumps(props, ensure_ascii=False)
        for k,v in props.items():
            if isinstance(v,(str,float,int,bool)):
                obj[k]=v
    return obj

def building_details(feature, building, collection, delta, roof_material, glass_material):
    """Illustrative roof edge and facade panels; no claim about real roof or windows."""
    footprint=feature['mesh']; rings=feature['rings']; height=feature['properties']['height_m']
    base=footprint['vertices']; count=len(base); roof_thickness=.22
    roof_verts=[(x,y,z) for z in (height+.03,height+.03+roof_thickness) for x,y in base]
    roof_faces=[list(reversed(face)) for face in footprint['faces']]
    roof_faces += [[i+count for i in face] for face in footprint['faces']]
    for ring in rings:
        for a,b in zip(ring,ring[1:]):
            off=len(roof_verts)
            roof_verts.extend([(a[0],a[1],height+.03),(b[0],b[1],height+.03),
                               (b[0],b[1],height+.03+roof_thickness),(a[0],a[1],height+.03+roof_thickness)])
            roof_faces.append([off,off+1,off+2,off+3])
    meta={'source':'VIETMAP','associated_building_id':feature['properties']['source_id'],
          'architectural_detail_estimated':True,'detail_kind':'illustrative_roof_edge'}
    roof=object_mesh('Roof_Detail_'+building.name,roof_verts,roof_faces,collection,roof_material,delta,meta)
    bm=bmesh.new();bm.from_mesh(roof.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(roof.data);bm.free()

    # Shallow, non-extruded panels on outward walls; same GIS footprint as the main mesh.
    panels=[]; panel_faces=[]
    for ring in rings[:1]:
        signed=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))
        outward=1 if signed>=0 else -1
        for a,b in zip(ring,ring[1:]):
            dx,dy=b[0]-a[0],b[1]-a[1]
            length=math.hypot(dx,dy)
            if length<4:continue
            nx,ny=outward*dy/length*.035,-outward*dx/length*.035
            bays=min(18,max(1,int(length/3.5)))
            floors=min(4,max(1,int(height/3.1)))
            for floor in range(floors):
                z0=1.6+floor*3.0
                z1=min(z0+1.15,height-.6)
                if z1<=z0:continue
                for bay in range(bays):
                    center=(bay+.5)/bays;half=min(.21, .65/bays)
                    lo=max(.04,center-half);hi=min(.96,center+half)
                    if hi<=lo:continue
                    off=len(panels)
                    panels.extend([(a[0]+dx*t+nx,a[1]+dy*t+ny,z) for t,z in
                                   ((lo,z0),(hi,z0),(hi,z1),(lo,z1))])
                    panel_faces.append([off,off+1,off+2,off+3])
    if panel_faces:
        object_mesh('Facade_Panels_'+building.name,panels,panel_faces,collection,glass_material,delta,
                    {'source':'VIETMAP','associated_building_id':feature['properties']['source_id'],
                     'architectural_detail_estimated':True,'detail_kind':'illustrative_facade_panels'})

def camera(name, target, distance, collection, scale):
    data=bpy.data.cameras.new(name); obj=bpy.data.objects.new(name,data)
    collection.objects.link(obj)
    obj.location = Vector(target) + Vector((0,-distance*.7,distance))
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO'; data.ortho_scale=scale; data.clip_end=100000
    return obj

def main():
    start=time.perf_counter()
    ap=argparse.ArgumentParser()
    ap.add_argument('--pilot', action='store_true')
    ap.add_argument('--render', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--no-basemap', action='store_true', help='Explicitly use untextured ground')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    manifest=read(DATA/'dataset_manifest.json')
    tiles=manifest['tiles']
    # Select actual dense, named-major, residential, narrow-road and unnamed-source samples.
    samples={}; best={}; label_owner={}
    for tile in tiles:
        d=read(DATA/'tiles'/f"{tile['id']}.json")
        fs=d['features']
        scores={'dense':sum(f['kind']=='buildings' for f in fs), 'major':sum(f['kind']=='roads' and f['properties']['category']=='major' and bool(f['properties']['name']) for f in fs), 'residential':sum(f['kind']=='buildings' and f['properties']['category']=='residential' for f in fs), 'narrow':sum(f['kind']=='roads' and f['properties']['width_m']<=4 for f in fs), 'incomplete':sum(f['kind']=='roads' and not f['properties']['name'] for f in fs)}
        for k,score in scores.items():
            if score>best.get(k,-1): best[k]=score; samples[k]=tile['id']
        for f in fs:
            if f['kind']=='roads':
                from shapely.geometry import LineString
                length=LineString(f['geometry']['coordinates']).length
                sid=f['properties']['source_id']
                if length>label_owner.get(sid,(0,None,None))[0]:
                    label_owner[sid]=(length,tile['id'],f['part'])
    if args.pilot: tiles=[t for t in tiles if t['id'] in samples.values()]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    scene.name='Ba_Diem_Post_Merger_Available_Extent'
    scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
    scene['coverage_status']=manifest['scope']
    scene['geometry_provider']=manifest.get('geometry_provider','OSM')
    scene['georeference_json']=json.dumps({k:manifest[k] for k in ('crs','origin','boundary')},ensure_ascii=False)
    ground=material('Flat_Unmeasured_Ground',(.28,.34,.25))
    basemap=None
    if not args.no_basemap:
        manifest_path=ROOT/'data/vietmap/basemap_manifest.json'
        if not manifest_path.exists():
            raise RuntimeError('Run scripts/prepare_vietmap_basemap.py first, or explicitly use --no-basemap')
        basemap=read(manifest_path)
        image_path=ROOT/basemap['image']
        if hashlib.sha256(image_path.read_bytes()).hexdigest()!=basemap['image_sha256']:
            raise RuntimeError('VietMap texture does not match basemap manifest')
        ground.name='VIETMAP_Georeferenced_Ground'
        image=bpy.data.images.load(str(image_path)); image.pack()
        texture=ground.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
        texture.extension='CLIP'
        shader=ground.node_tree.nodes.get('Principled BSDF')
        ground.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
        ground['attribution']=basemap['attribution']
        ground['georeferencing_json']=json.dumps({k:basemap[k] for k in ('crs','bounds','zoom','image_sha256')})
        scene['basemap_provider']='VIETMAP'
        scene['basemap_attribution']=basemap['attribution']
        from pyproj import Transformer
        to_mercator=Transformer.from_crs(manifest['crs'],3857,always_xy=True)
    asphalt=material('Road_Asphalt',(.12,.13,.14))
    paints={k:material('Road_Paint_'+k,(.65,.66,.63),3500 if k=='major' else 650) for k in ('major','local')}
    mats={k:material('Building_'+k,c) for k,c in {'residential':(.55,.48,.40),'commercial':(.43,.51,.55),'industrial':(.46,.48,.50),'other':(.60,.58,.51)}.items()}
    massing_colors={'small_footprint':(.68,.57,.46),'narrow_footprint':(.62,.51,.42),
                    'medium_footprint':(.58,.60,.59),'broad_footprint':(.49,.54,.56),
                    'very_large_footprint':(.47,.50,.53)}
    massing_mats={k:material('Estimated_Facade_'+k,c) for k,c in massing_colors.items()}
    roof_mats={k:material('Estimated_Roof_'+k,tuple(max(.08,v*.72) for v in c)) for k,c in massing_colors.items()}
    window_mat=material('Illustrative_Window_Panels',(.09,.18,.24))
    mapped_mats={k:material('Mapped_'+k,c) for k,c in {'water':(.12,.36,.48),'landuse':(.38,.47,.31),'island':(.38,.42,.29)}.items()}
    boundary_mat=material('Boundary_Configuration_Unverified',(.50,.20,.17))
    font=bpy.data.fonts.load('C:/Windows/Fonts/arial.ttf')
    ASSETS.mkdir(parents=True,exist_ok=True)
    occupied=[]; result=[]
    code_hash=hashlib.sha256(Path(__file__).read_bytes()+(ROOT/'scripts/hcmc_road_names.py').read_bytes()+(ROOT/'scripts/generate_ba_diem_3d.py').read_bytes()).hexdigest()
    for tile in tiles:
        tid=tile['id']; d=read(DATA/'tiles'/f'{tid}.json')
        asset=ASSETS/f'{tid}.blend'; status=ASSETS/f'{tid}.status.json'
        basemap_signature={k:basemap[k] for k in ('image_sha256','crs','bounds')} if basemap else None
        stamp=hashlib.sha256((tile['sha256']+code_hash+json.dumps(basemap_signature,sort_keys=True)+json.dumps(manifest['origin'])+json.dumps(label_owner,sort_keys=True)+json.dumps(occupied)+('pilot' if args.pilot else 'full')).encode()).hexdigest()
        if not args.force and asset.exists() and status.exists() and read(status)['stamp']==stamp:
            entry=read(status); occupied.extend(entry['placed_names'])
        else:
            root=bpy.data.collections.new('Tile_'+tid)
            scene.collection.children.link(root)
            cols={}
            def col(name):
                if name not in cols:
                    cols[name]=bpy.data.collections.new(name+'__'+tid); root.children.link(cols[name])
                return cols[name]
            delta=(d['origin'][0]-manifest['origin'][0],d['origin'][1]-manifest['origin'][1],0)
            terrain=d['terrain']
            terrain_obj=object_mesh('Flat_Ground_'+tid,[(x,y,0) for x,y in terrain['vertices']],terrain['faces'],col('Terrain'),ground,delta,{'elevation_estimated':True})
            if basemap:
                uv=terrain_obj.data.uv_layers.new(name='VietMap_WebMercator_UV')
                west,south,east,north=basemap['bounds']
                for loop in terrain_obj.data.loops:
                    point=terrain_obj.data.vertices[loop.vertex_index].co
                    mx,my=to_mercator.transform(point.x+d['origin'][0],point.y+d['origin'][1])
                    uv.data[loop.index].uv=((mx-west)/(east-west),(my-south)/(north-south))
                terrain_obj['basemap_provider']='VIETMAP'
            counts={}; before=len(occupied)
            building_shapes=[shape(f['geometry']) for f in d['features'] if f['kind']=='buildings']
            obstacle_index=STRtree(building_shapes)
            for f in d['features']:
                p=f['properties']; geometry=f['mesh']; verts=geometry['vertices']; faces=geometry['faces']
                name=p['source_id']+'_'+str(f['part'])
                if f['kind']=='buildings':
                    height=p['height_m']; n=len(verts)
                    vertices=[(x,y,z) for z in (0,height) for x,y in verts]
                    meshfaces=[list(reversed(face)) for face in faces]+[[i+n for i in face] for face in faces]
                    for ring in f['rings']:
                        for a,b in zip(ring,ring[1:]):
                            off=len(vertices); vertices.extend([(a[0],a[1],0),(b[0],b[1],0),(b[0],b[1],height),(a[0],a[1],height)])
                            meshfaces.append([off,off+1,off+2,off+3])
                    category={'residential':'Residential_Buildings','commercial':'Commercial_Buildings','industrial':'Industrial_Buildings','other':'Other_Buildings'}[p['category']]
                    form=p.get('visual_massing_class','medium_footprint')
                    obj=object_mesh(name,vertices,meshfaces,col(category),massing_mats.get(form,mats[p['category']]),delta,p)
                    bm=bmesh.new();bm.from_mesh(obj.data)
                    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
                    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
                    bm.to_mesh(obj.data);bm.free()
                    building_details(f,obj,col(category),delta,roof_mats.get(form,roof_mats['medium_footprint']),window_mat)
                elif f['kind']=='roads':
                    obj=object_mesh(name,[(x,y,.06) for x,y in verts],faces,col('Major_Roads' if p['category']=='major' else 'Local_Roads'),asphalt,delta,p)
                    reason='other_tile_or_part'
                    if label_owner[p['source_id']][1:] == (tid,f['part']):
                        road=shape(f['geometry'])
                        nearby=[building_shapes[int(i)] for i in obstacle_index.query(road.buffer(p['width_m']))]
                        text,reason=embedded_name(f,font,occupied,d['origin'],nearby)
                        if text:
                            bm=bmesh.new(); bm.from_mesh(obj.data)
                            append_bmesh_faces(bm,text,1)
                            obj.data.materials.append(paints[p['category']])
                            bm.to_mesh(obj.data); bm.free(); text.free()
                            obj['embedded_road_name']=p['name']
                    obj['label_status']=reason; counts[reason]=counts.get(reason,0)+1
                else:
                    layer=f['kind'];geo=shape(f['geometry'])
                    collection_name={'water':'Water_Bodies','landuse':'Land_Use','island':'Mapped_Islands','admin_line':'Administrative_Boundaries','boundary':'Administrative_Boundaries','poi':'Mapped_POIs','admin_point':'Administrative_Points','waterway':'Waterways','railway':'Railways'}.get(layer,'Other_Mapped_Features')
                    if 'Polygon' in geo.geom_type:
                        obj=object_mesh(name,[(x,y,.025 if layer=='water' else .015) for x,y in verts],faces,col(collection_name),mapped_mats.get(layer,mapped_mats['landuse']),delta,p)
                    elif geo.geom_type=='LineString':
                        curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=.10
                        spline=curve.splines.new('POLY');spline.points.add(len(geo.coords)-1)
                        for point,xy in zip(spline.points,geo.coords):point.co=(xy[0],xy[1],.09,1)
                        obj=bpy.data.objects.new(name,curve);col(collection_name).objects.link(obj);obj.location=delta;curve.materials.append(boundary_mat)
                        obj['source_attributes_json']=json.dumps(p,ensure_ascii=False)
                        obj['source_id']=p['source_id'];obj['source']=p['source']
                    elif geo.geom_type=='Point':
                        obj=bpy.data.objects.new(name,None);col(collection_name).objects.link(obj)
                        obj.location=(delta[0]+geo.x,delta[1]+geo.y,.1)
                        obj.empty_display_type='PLAIN_AXES';obj.empty_display_size=2
                        obj['source_attributes_json']=json.dumps(p,ensure_ascii=False)
                        obj['source_id']=p['source_id'];obj['source']=p['source']
                        obj['name']=p['name'];obj['point_marker_only']=True
            boundary=shape(d['boundary'])
            lines=list(boundary.geoms) if hasattr(boundary,'geoms') else [boundary]
            curve=bpy.data.curves.new('Boundary_'+tid,'CURVE'); curve.dimensions='3D';curve.bevel_depth=.30
            for line in lines:
                if not hasattr(line,'coords'):continue
                spline=curve.splines.new('POLY'); spline.points.add(len(line.coords)-1)
                for point,xy in zip(spline.points,line.coords):point.co=(xy[0],xy[1],.10,1)
            obj=bpy.data.objects.new('Boundary_'+tid,curve); col('Administrative_Boundaries').objects.link(obj);obj.location=delta;curve.materials.append(boundary_mat)
            bpy.data.libraries.write(str(asset),{root},fake_user=True,compress=True)
            entry={'id':tid,'stamp':stamp,'label_counts':counts,'placed_names':occupied[before:], 'features':len(d['features'])}
            status.write_text(json.dumps(entry,ensure_ascii=False,indent=2),encoding='utf-8')
            scene.collection.children.unlink(root)
            # Remove generated objects after writing; master loads linked tile assets.
            for obj in list(root.all_objects):bpy.data.objects.remove(obj,do_unlink=True)
            for c in list(root.children):bpy.data.collections.remove(c)
            bpy.data.collections.remove(root)
        result.append(entry)
        print(f'Tile {tid}: {entry["features"]} features; {entry["label_counts"]}',flush=True)
    # Link only after all tiles are built so font conversion never evaluates earlier city tiles.
    for tile in tiles:
        with bpy.data.libraries.load(str(ASSETS/f"{tile['id']}.blend"),link=True) as (src,dst):
            dst.collections=['Tile_'+tile['id']]
        scene.collection.children.link(dst.collections[0])
    cameras=bpy.data.collections.new('Cameras_And_Lighting');scene.collection.children.link(cameras)
    targets=[]
    for tile in tiles:
        d=read(DATA/'tiles'/f"{tile['id']}.json")
        targets.append((d['origin'][0]-manifest['origin'][0]+500,d['origin'][1]-manifest['origin'][1]+500,0))
    extent_x=[p[0] for p in targets];extent_y=[p[1] for p in targets]
    overview_target=((min(extent_x)+max(extent_x))/2,(min(extent_y)+max(extent_y))/2,0)
    overview_span=max(max(extent_x)-min(extent_x),max(extent_y)-min(extent_y))+1500
    overview=camera('City_Overview_Camera',overview_target,max(1500,overview_span*.85),cameras,max(2200,overview_span*1.35))
    def target(k):
        d=read(DATA/'tiles'/f'{samples[k]}.json')
        return (d['origin'][0]-manifest['origin'][0]+500,d['origin'][1]-manifest['origin'][1]+500,0)
    camera('Urban_District_Camera',target('dense'),800,cameras,1000)
    camera('Residential_Neighborhood_Camera',target('residential'),250,cameras,350)
    road_target=(0,0,0)
    if occupied:
        xy=occupied[0][0]; road_target=(xy[0]-manifest['origin'][0],xy[1]-manifest['origin'][1],0)
    label_cam=camera('Road_Label_Test_Camera',road_target,85,cameras,110)
    sun=bpy.data.lights.new('Sun','SUN');sun.energy=2
    lamp=bpy.data.objects.new('Sun',sun);cameras.objects.link(lamp);lamp.rotation_euler=(.4,-.3,-.4)
    scene.world=bpy.data.worlds.new('World');scene.world.color=(.5,.5,.5)
    scene.camera=overview;scene.render.engine='CYCLES';scene.cycles.samples=16
    scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    filename=ROOT/('Ba_Diem_Post_Merger_Pilot.blend' if args.pilot else 'Ba_Diem_3D.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(filename),relative_remap=True)
    validation={'mode':'pilot' if args.pilot else 'full','scope':manifest['scope'],'tiles':result,'pilot_samples':samples,'objects':len(scene.objects),'generation_seconds':time.perf_counter()-start,'blend':str(filename),'floating_text_objects':sum(o.type=='FONT' for o in scene.objects),'label_collections':sum('label' in c.name.lower() for c in bpy.data.collections)}
    validation['basemap_provider']='VIETMAP' if basemap else None
    validation['geometry_provider']=manifest.get('geometry_provider','OSM')
    (ASSETS/('pilot_validation.json' if args.pilot else 'validation.json')).write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
    if args.render:
        for cam in (overview,label_cam):
            scene.camera=cam;scene.render.filepath=str(ASSETS/(('pilot_' if args.pilot else '')+cam.name+'.png'))
            bpy.ops.render.render(write_still=True)
    print(json.dumps({k:v for k,v in validation.items() if k!='tiles'},ensure_ascii=True),flush=True)

if __name__=='__main__':main()
