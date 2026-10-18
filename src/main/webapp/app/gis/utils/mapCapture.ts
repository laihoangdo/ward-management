export interface MapCaptureOfficer {
  fullName: string;
  rank: string;
  unit: string;
  area?: string;
}

/** Administrative frame is part of the PNG, including copies, shares and prints. */
export function frameMapCapture(source: HTMLCanvasElement, officer: MapCaptureOfficer | undefined, details: string[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Không tạo được khung ảnh bản đồ.');
  const scale = Math.max(1, source.width / (source.clientWidth || source.width / 2));
  const margin = 14 * scale;
  const lineHeight = 22 * scale;
  const font = `${14 * scale}px sans-serif`;
  ctx.font = font;
  const wrap = (text: string) => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      if (line && ctx.measureText(`${line} ${word}`).width > canvas.width - margin * 2) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  };
  const header = [
    ...wrap(officer?.unit || 'CÔNG AN ĐỊA BÀN PHỤ TRÁCH'),
    ...wrap('BẢN ĐỒ KHÔNG GIAN 3D THỰC ĐỊA'),
    ...wrap(`Cán bộ khu vực: ${officer?.fullName ? [officer.rank, officer.fullName].filter(Boolean).join(' · ') : 'Chưa có thông tin'}`),
    ...(officer?.area ? wrap(`Địa bàn phụ trách: ${officer.area}`) : []),
  ];
  const footer = details.flatMap(wrap);
  const headerHeight = margin * 2 + header.length * lineHeight;
  const footerHeight = margin * 2 + footer.length * lineHeight;
  canvas.height = headerHeight + source.height + footerHeight;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  header.forEach((text, i) => ctx.fillText(text, margin, margin + i * lineHeight, canvas.width - margin * 2));
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, headerHeight - 3 * scale, canvas.width, 3 * scale);
  ctx.drawImage(source, 0, headerHeight);
  ctx.fillStyle = '#cbd5e1';
  footer.forEach((text, i) =>
    ctx.fillText(text, margin, headerHeight + source.height + margin + i * lineHeight, canvas.width - margin * 2),
  );
  return canvas;
}
