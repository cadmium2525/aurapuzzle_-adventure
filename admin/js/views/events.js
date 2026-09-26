import { $, card, field, readForm, toast, esc } from '../ui.js';
import { draft, setSetting, putBlob } from '../draft.js';
import * as G from '../gamedata.js';
import { publicationFields, readPublication, validPublication } from '../publication.js';
import { toWebp, toBannerWebp } from '../image.js';
let editing=null;
const all=()=>draft().settings.events || G.CUSTOM_SETTINGS.events || [];
export default {render(view) {
  if (!editing) {
    view.innerHTML=card('期間限定イベント設定', `<p>ここでは開催期間・告知バナー・交換所を管理します。イベントダンジョンのフロアは「ダンジョン」タブで編集します。イベントを非公開にすると、紐づくガチャ・ダンジョン・交換所を一括停止できます。</p>${all().map(e=>`<button class="btn" data-edit="${esc(e.id)}">${esc(e.name)}</button>`).join('')}<button class="btn primary" id="newEvent">＋ イベント</button>`);
    $('newEvent').onclick=()=>{editing={id:'',name:'',currency:{id:'',name:'',icon:''},shop:[]};this.render(view);};
    view.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editing=structuredClone(all().find(e=>e.id===b.dataset.edit));this.render(view);});
    return;
  }
  const e=editing;
  view.innerHTML=card('イベント編集',`${field('イベントID','id',e.id)}${field('イベント名','name',e.name)}${field('説明','description',e.description || '',{type:'textarea'})}
    ${publicationFields(e,false)}${field('交換素材ID','currencyId',e.currency.id)}${field('交換素材名','currencyName',e.currency.name)}
    ${field('交換素材画像パス','currencyIcon',e.currency.icon || '')}<label class="drop">交換素材画像をWebPに変換<input type="file" id="currencyFile" accept="image/*"></label>
    ${field('イベントバナーのパス','banner',e.banner || '')}<label class="drop">バナーをWebPに変換<input type="file" id="eventBannerFile" accept="image/*"></label>
    <h3>イベント専用ガチャ</h3>
    ${field('専用ガチャ','gachaEnabled',e.gacha?.enabled !== false && !!e.gacha ? 'true' : 'false',{type:'select',options:[['false','なし'],['true','開催期間中に公開']]})}
    ${field('ガチャの表示名','gachaName',e.gacha?.name || '')}
    ${field('PUキャラID（カンマ区切り）','gachaPickups',(e.gacha?.pickupIds || []).join(', '))}
    ${field('★4帯のうちPU全員が占める割合 (%)','gachaRate',(e.gacha?.pickupRate ?? .5)*100,{type:'number',min:0,max:100})}
    <p class="lead small">PUはこのイベントの★4ガチャキャラを指定。設定割合をPU全員で均等に分けます。50%・4人なら通常抽選で各1.5%（合計6%）。残りには通常キャラが登場します。</p>
    ${field('交換商品（JSON配列）','shop',JSON.stringify(e.shop,null,2),{type:'textarea',rows:12})}
    <p class="lead small">商品: id, type (character / material / homeTheme), price（交換素材数）, totalLimit。キャラは charId、素材は matId と amount、ホーム背景は themeId・name・image（assets/ui/以下のWebPパス）を指定。背景は買い切りなので totalLimit: 1 にしてください。商品IDはイベントごとに一意にしてください。</p>
    <label class="drop">ホーム背景画像をWebPに変換（商品JSONの image パスへ保存）<input type="file" id="homeThemeFile" accept="image/*"></label>
    <button class="btn primary" id="saveEvent">下書きに保存</button><button class="btn" id="cancelEvent">戻る</button>`);
  const collect=()=>{
    const v=readForm(view);
    Object.assign(e,readPublication(v),{id:v.id.trim(),name:v.name.trim(),description:v.description,banner:v.banner.trim(),currency:{id:v.currencyId.trim(),name:v.currencyName.trim(),icon:v.currencyIcon.trim(),emoji:'🍬',color:'#FFB658'},shop:JSON.parse(v.shop)});
    delete e.eventId;
    e.gacha={name:v.gachaName.trim(),enabled:v.gachaEnabled==='true',pickupRate:Number(v.gachaRate)/100,pickupIds:[...new Set(v.gachaPickups.split(',').map(id=>id.trim()).filter(Boolean))]};
  };
  $('saveEvent').onclick=()=>{try {
    collect();
    if (!/^[a-z][a-z0-9_]+$/.test(e.id) || !e.name || !validPublication(e) || !e.availableFrom || !e.availableUntil) throw Error('ID・名前・開始終了日時を確認してください');
    if (!/^mt_[a-z0-9_]+$/.test(e.currency.id) || !e.currency.name) throw Error('交換素材IDはmt_で始めてください');
    if (!Array.isArray(e.shop)) throw Error('商品は配列で指定してください');
    if (e.gacha.enabled) {
      const chars=new Map([...G.CHARACTERS,...draft().characters].map(c=>[c.id,c]));
      if (!e.gacha.name || !Number.isFinite(e.gacha.pickupRate) || e.gacha.pickupRate<0 || e.gacha.pickupRate>1 || !e.gacha.pickupIds.length) throw Error('ガチャ名・PUキャラ・割合を確認してください');
      for (const id of e.gacha.pickupIds) {
        const c=chars.get(id);
        if (!c || c.eventId!==e.id || c.rarity!==4 || c.giftOnly || c.raidDrop) throw Error(`PU ${id} はこのイベントの★4ガチャキャラを指定してください`);
      }
    }
    const ids=new Set();
    for (const i of e.shop) {
      if (!i.id || ids.has(i.id) || !Number.isInteger(i.price) || i.price<1 || !Number.isInteger(i.totalLimit) || i.totalLimit<1) throw Error('商品IDの重複・価格・通算上限を確認してください');
      ids.add(i.id);
      if (i.type==='character') { if (![...G.CHARACTERS,...draft().characters].some(c=>c.id===i.charId)) throw Error(`キャラ ${i.charId} を先に登録してください`); }
      else if (i.type==='material') { if (!G.materialById(i.matId) || !Number.isInteger(i.amount) || i.amount<1) throw Error('素材と数量を確認してください'); }
      else if (i.type==='homeTheme') {
        if (!/^[a-z][a-z0-9_]+$/.test(i.themeId || '') || !i.name ||
            !/^assets\/ui\/[a-zA-Z0-9_/-]+\.webp$/.test(i.image || '') || i.totalLimit !== 1)
          throw Error('ホーム背景は themeId・name・assets/ui/以下のWebPパス・通算上限1を指定してください');
      }
      else throw Error('商品のtypeはcharacter / material / homeTheme から選んでください');
    }
    setSetting('events',[...all().filter(x=>x.id!==e.id),structuredClone(e)]);editing=null;toast('イベントを下書きに保存しました','ok');this.render(view);
  }catch(err){toast(err.message,'ng');}};
  $('cancelEvent').onclick=()=>{editing=null;this.render(view);};
  for (const [id,kind] of [['currencyFile','currency'],['eventBannerFile','banner']]) $(id).onchange=async ev=>{
    try {collect();const file=ev.target.files[0];if(!file)return;
      const path=kind==='currency' ? e.currency.icon : e.banner;
      if(!/^assets\/[a-zA-Z0-9_/-]+\.webp$/.test(path)) throw Error('保存先はassets/以下のWebPパスを指定してください');
      putBlob(path,kind==='currency' ? await toWebp(file,128) : await toBannerWebp(file));toast('WebP画像を下書きに保存しました','ok');
    }catch(err){toast(err.message,'ng');}
  };
  $('homeThemeFile').onchange=async ev=>{
    try {collect();const file=ev.target.files[0];if(!file)return;
      const themes=e.shop.filter(i=>i.type==='homeTheme');
      if (themes.length!==1 || !/^assets\/ui\/[a-zA-Z0-9_/-]+\.webp$/.test(themes[0].image || ''))
        throw Error('商品JSONにホーム背景を1件登録し、image に assets/ui/以下のWebPパスを指定してください');
      putBlob(themes[0].image,await toWebp(file,1600));toast('ホーム背景をWebPに変換して下書きに保存しました','ok');
    }catch(err){toast(err.message,'ng');}
  };
}};
