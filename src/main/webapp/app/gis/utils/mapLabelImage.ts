/** Prefix of the style images drawn on demand for house-number labels (no glyph server needed offline). */
export const LABEL_IMAGE_PREFIX = 'field-label:';
/** Rendered at 2x so text stays sharp; pass this as the image pixelRatio. */
export const LABEL_PIXEL_RATIO = 2;
export const MAX_LABEL_LENGTH = 18;

export const labelText = (value: string): string => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > MAX_LABEL_LENGTH ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…` : text;
};

/** A white pill with dark text, legible on satellite imagery and on both street styles. */
export function drawLabelImage(text: string): ImageData | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context || !text) return null;
  const font = '600 22px Roboto, Inter, Arial, sans-serif';
  context.font = font;
  const width = Math.ceil(context.measureText(text).width) + 20;
  const height = 36;
  canvas.width = width;
  canvas.height = height;
  // Resizing resets the context state.
  context.font = font;
  context.textBaseline = 'middle';
  context.fillStyle = 'rgb(255 255 255 / 94%)';
  context.strokeStyle = '#1c4e3a';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(1, 1, width - 2, height - 2, 10);
  context.fill();
  context.stroke();
  context.fillStyle = '#172c35';
  context.fillText(text, 10, height / 2 + 1);
  return context.getImageData(0, 0, width, height);
}
