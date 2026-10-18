import { describe, expect, it } from 'vitest';
import { EMPTY_RASTER_TILE, localRasterRequest } from './localRasterRequest';
import catalog from '../data/localRasterTiles.json';
import { crc32, inflateSync } from 'node:zlib';

describe('offline raster tile requests', () => {
  it('provides a PNG with valid chunk checksums and a transparent RGBA pixel', () => {
    const png = Buffer.from(EMPTY_RASTER_TILE.split(',')[1], 'base64');
    let imageData: Buffer | undefined;
    const chunks: string[] = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      const type = png.subarray(offset + 4, offset + 8).toString();
      const data = png.subarray(offset + 8, offset + 8 + length);
      expect(png.readUInt32BE(offset + 8 + length), `${type} CRC`).toBe(crc32(png.subarray(offset + 4, offset + 8 + length)));
      chunks.push(type);
      if (type === 'IHDR') {
        expect(data.readUInt32BE(0)).toBe(1);
        expect(data.readUInt32BE(4)).toBe(1);
        expect(data[8]).toBe(8);
        expect(data[9]).toBe(6);
      }
      if (type === 'IDAT') imageData = data;
      offset += length + 12;
    }
    expect(chunks).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect([...inflateSync(imageData!)]).toEqual([0, 0, 0, 0, 0]);
  });
  it('keeps an existing satellite image URL', () => {
    const url = 'http://localhost:9000/content/assets/badiem_satellite/18/208643/123124.jpg';
    expect(localRasterRequest(url)).toEqual({ url });
  });
  it('replaces missing tiles inside the rectangular bounds with a valid transparent image', () => {
    const url = 'http://localhost:9000/content/assets/badiem_satellite/18/208643/123103.jpg';
    expect(localRasterRequest(url).url).toBe(EMPTY_RASTER_TILE);
    expect(atob(EMPTY_RASTER_TILE.split(',')[1]).slice(1, 4)).toBe('PNG');
  });
  it('covers missing street tiles and tiles at unavailable zoom levels', () => {
    expect(localRasterRequest('/content/assets/badiem_map/18/0/0.png').url).toBe(EMPTY_RASTER_TILE);
    expect(localRasterRequest('/content/assets/badiem_satellite/9/407/240.jpg').url).toBe(EMPTY_RASTER_TILE);
  });
  it('preserves all catalogued files and leaves module, API and boundary requests unchanged', () => {
    for (const [kind, keys] of Object.entries(catalog)) {
      for (const key of keys) {
        const url = `/content/assets/badiem_${kind}/${key}.${kind === 'map' ? 'png' : 'jpg'}`;
        expect(localRasterRequest(url).url).toBe(url);
      }
    }
    for (const url of ['/api/gis/field-buildings', '/content/assets/xa_ba_diem.geojson?raw', '/app/gis/App.tsx'])
      expect(localRasterRequest(url).url).toBe(url);
  });
});
