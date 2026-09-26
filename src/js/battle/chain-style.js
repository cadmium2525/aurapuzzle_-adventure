/** Keep the first six chains unchanged; rainbow starts at exactly seven. */
export function chainLabelFill(ctx, count, x, width) {
  if (count < 7) return count >= 5 ? '#FFC65C' : count >= 3 ? '#8FD8FF' : '#FFFFFF';
  const colors = ['#FF809D', '#FFB968', '#FFE879', '#85F5AF', '#80E8FF', '#AAA0FF', '#F4A0FF'];
  const gradient = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
  colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
  return gradient;
}

export function chainBanner(count) {
  return `<span class="chain${count >= 7 ? ' chain-rainbow' : ''}">${count} COMBO</span>`;
}
