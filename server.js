import express from 'express';
import * as cheerio from 'cheerio';

const app = express();
app.use(express.json({limit:'1mb'}));
app.use(express.static('public'));

const CONTACTS = ['09169656746','09386204943'];

function clean(s='') { return s.replace(/\\s+/g,' ').trim(); }
function find(regex, text='') { const m=text.match(regex); return m ? clean(m[1]) : ''; }

function buildAd(d) {
  const title = d.title || 'آگهی ملک';
  const lines = [
    `🏠 ${title}`,
    '',
    d.area ? `📐 متراژ: ${d.area}` : '',
    d.land ? `🌳 زمین: ${d.land}` : '',
    d.build ? `🏗 بنا: ${d.build}` : '',
    d.rooms ? `🛏 خواب: ${d.rooms}` : '',
    d.floor ? `🏢 طبقه: ${d.floor}` : '',
    d.parking ? `🚗 پارکینگ: ${d.parking}` : '',
    d.storage ? `📦 انباری: ${d.storage}` : '',
    d.elevator ? `🛗 آسانسور: ${d.elevator}` : '',
    d.location ? `📍 موقعیت: ${d.location}` : '',
    '',
    d.price ? `💰 قیمت: ${d.price}` : '',
    d.description ? `\n📝 توضیحات:\n${d.description}` : '',
    '',
    '📞 تماس:',
    ...CONTACTS
  ];
  return lines.filter((x,i,a)=>x!=='' || (i>0 && a[i-1]!=='' )).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

app.post('/api/convert', async (req,res)=>{
  const {url} = req.body || {};
  if(!url || !/^https?:\/\/(www\.)?divar\.ir\//i.test(url)) return res.status(400).json({error:'لینک معتبر دیوار وارد کنید.'});
  try {
    const r = await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; DivarAdConverter/1.0)'}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    const $ = cheerio.load(html);
    const title = clean($('h1').first().text()) || clean($('meta[property="og:title"]').attr('content') || '');
    const description = clean($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '');
    const body = clean($('body').text());
    const text = `${title} ${description} ${body}`;
    const d = {
      title,
      description: description && description !== title ? description : '',
      area: find(/(?:متراژ|زیربنا|مساحت)\s*[:：]?\s*([0-9۰-۹]+\s*(?:متر|مترمربع|m²)?)/i,text),
      land: find(/(?:زمین|مساحت زمین)\s*[:：]?\s*([0-9۰-۹]+\s*(?:متر|مترمربع)?)/i,text),
      build: find(/(?:بنا|مساحت بنا)\s*[:：]?\s*([0-9۰-۹]+\s*(?:متر|مترمربع)?)/i,text),
      rooms: find(/(?:تعداد خواب|خواب)\s*[:：]?\s*([0-9۰-۹]+)/i,text),
      floor: find(/(?:طبقه)\s*[:：]?\s*([^،,؛;\n]{1,20})/i,text),
      parking: find(/(?:پارکینگ)\s*[:：]?\s*([^،,؛;\n]{1,20})/i,text),
      storage: find(/(?:انباری)\s*[:：]?\s*([^،,؛;\n]{1,20})/i,text),
      elevator: find(/(?:آسانسور)\s*[:：]?\s*([^،,؛;\n]{1,20})/i,text),
      location: find(/(?:موقعیت|محله|آدرس)\s*[:：]?\s*([^،,؛;\n]{1,60})/i,text),
      price: find(/(?:قیمت|قیمت کل)\s*[:：]?\s*([^\n]{1,40})/i,text)
    };
    res.json({data:d, output:buildAd(d), note:'استخراج خودکار به ساختار فعلی صفحه دیوار وابسته است؛ اگر بخشی در صفحه قابل دسترسی نباشد، می‌توانید متن خروجی را ویرایش کنید.'});
  } catch(e) {
    res.status(502).json({error:'صفحه آگهی از سمت دیوار قابل دریافت نبود. ممکن است آگهی حذف شده باشد یا دسترسی خودکار به صفحه محدود شده باشد.', detail:e.message});
  }
});

app.listen(process.env.PORT || 3000,()=>console.log('Divar Ad Converter running'));
