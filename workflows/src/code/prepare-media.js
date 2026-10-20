// Prepare Media: decide how the image is produced.
//   brand -> download featured image, add PlacidWay brand bar
//   card  -> no usable image: render a branded title card
//   none  -> branding disabled: Facebook pulls the original image URL directly
const ctx = $json;
const brand = String(ctx.settings.brand_images) !== 'false';
const labels = { article: 'PATIENT GUIDE', package: 'TREATMENT PACKAGE', answer: 'PATIENT Q&A', news: 'PLACIDWAY NEWS' };
let title = ctx.source.title.replace(/\s*\|\s*.*$/, '').trim();
if (title.length > 96) title = title.slice(0, 93).replace(/\s+\S*$/, '') + '...';

const route = !brand ? 'none' : ctx.source.image ? 'brand' : 'card';

// PlacidWay serves images through Cloudflare (/cdn-cgi/image/, allowed in robots.txt).
// Ask it for a full-bleed 1200x630 smart crop instead of the white-padded OG version.
let downloadUrl = ctx.source.image;
if (downloadUrl) {
  const COVER = 'quality=85,fit=cover,gravity=auto,width=1200,height=630';
  const m = downloadUrl.match(/^(https:\/\/www\.placidway\.com\/cdn-cgi\/image\/)[^/]+\/(.+)$/);
  if (m) downloadUrl = `${m[1]}${COVER}/${m[2]}`;
  else if (/^https:\/\/placidwaycdn\.s3\.amazonaws\.com\//.test(downloadUrl)) downloadUrl = `https://www.placidway.com/cdn-cgi/image/${COVER}/${downloadUrl}`;
}
return {
  json: {
    ...ctx,
    media: {
      route,
      file: `post-${ctx.post_id}.jpg`,
      download_url: downloadUrl,
      label: labels[ctx.source.type] || 'PLACIDWAY',
      category: String(ctx.source.category_group || ctx.source.category || '').toUpperCase(),
      title,
    },
  },
};
