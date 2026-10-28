-- Derived spatial data only. GeoJSON, provenance and all business fields remain unchanged.
CREATE FUNCTION public.gis_polygon(source jsonb) RETURNS geometry
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE AS $$
DECLARE g geometry; value jsonb;
BEGIN
    IF source='null'::jsonb THEN RETURN NULL; END IF;
    value:=CASE WHEN source->>'type'='Feature' THEN source->'geometry' ELSE source END;
    IF value IS NULL OR value='null'::jsonb THEN RAISE EXCEPTION 'Missing polygon geometry'; END IF;
    IF value->>'type' NOT IN ('Polygon','MultiPolygon') OR value->>'type' IS NULL THEN
        RAISE EXCEPTION 'Expected Polygon/MultiPolygon in WGS84';
    END IF;
    g:=ST_GeomFromGeoJSON(value);
    IF ST_SRID(g)<>4326 OR ST_CoordDim(g)<>2 OR ST_IsEmpty(g) OR NOT ST_IsValid(g)
       OR ST_XMin(Box3D(g)) < -180 OR ST_XMax(Box3D(g)) > 180
       OR ST_YMin(Box3D(g)) < -90 OR ST_YMax(Box3D(g)) > 90 THEN
        RAISE EXCEPTION 'Invalid polygon, dimensionality or WGS84 coordinates; review source, do not repair silently';
    END IF;
    RETURN ST_Multi(g);
END $$;

ALTER TABLE public.hamlet ADD boundary_geom geometry(MultiPolygon,4326)
    GENERATED ALWAYS AS (public.gis_polygon(nullif(btrim(boundary_geo_json),'')::jsonb)) STORED;
CREATE INDEX ix_hamlet_boundary_geom ON public.hamlet USING GIST(boundary_geom);
ALTER TABLE public.gis_field_building ADD footprint_geom geometry(MultiPolygon,4326)
    GENERATED ALWAYS AS (public.gis_polygon(feature_json::jsonb->'geometry')) STORED;
CREATE INDEX ix_field_building_footprint_geom ON public.gis_field_building USING GIST(footprint_geom);
ALTER TABLE public.gis_field_building ADD CONSTRAINT ck_field_building_geometry_present CHECK(footprint_geom IS NOT NULL);

-- The legacy foundation columns exist after changeset 20261008210000-2. Keep them synchronized too.
CREATE FUNCTION public.sync_legacy_gis_geometry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g geometry;
BEGIN
    IF TG_TABLE_NAME='gis_building' THEN
        NEW.footprint_geom:=public.gis_polygon(NEW.footprint_geojson::jsonb);
    ELSE
        g:=ST_GeomFromGeoJSON(NEW.geometry_geojson::jsonb);
        IF ST_GeometryType(g) NOT IN ('ST_LineString','ST_MultiLineString') OR ST_SRID(g)<>4326
           OR ST_CoordDim(g)<>2 OR ST_IsEmpty(g) OR NOT ST_IsValid(g)
           OR ST_XMin(Box3D(g)) < -180 OR ST_XMax(Box3D(g)) > 180
           OR ST_YMin(Box3D(g)) < -90 OR ST_YMax(Box3D(g)) > 90 THEN
            RAISE EXCEPTION 'Invalid WGS84 road geometry';
        END IF;
        NEW.line_geom:=ST_Multi(g);
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER sync_building_geom BEFORE INSERT OR UPDATE ON public.gis_building
    FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_gis_geometry();
CREATE TRIGGER sync_road_geom BEFORE INSERT OR UPDATE ON public.gis_road
    FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_gis_geometry();
UPDATE public.gis_building SET footprint_geojson=footprint_geojson;
UPDATE public.gis_road SET geometry_geojson=geometry_geojson;
COMMENT ON COLUMN public.household.location_geom IS 'Derived position only: RANDOM_WITHIN_TC2 is not a surveyed or verified location';
COMMENT ON COLUMN public.hamlet.boundary_geom IS 'Derived from existing provisional boundaries; PostGIS does not improve source accuracy';
