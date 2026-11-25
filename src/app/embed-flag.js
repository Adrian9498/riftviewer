// ¿La app está incrustada en otra página (app/?embed=1)? Ver ./embed.js.
export const EMBED = typeof location !== 'undefined' && /[?&]embed(=|&|$)/.test(location.search);
