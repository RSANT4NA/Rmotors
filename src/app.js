(function () {
  'use strict';

  var WA = '5548999583069';
  var PHONE_TXT = '(48) 99958-3069';
  var LIMIT = 15.4 * 1024 * 1024;
  var MAX_FOTOS = 6;
  var STATUS = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' };
  var RANK = { disponivel: 0, reservado: 1, vendido: 2 };
  var RESET_FALLBACK = ':root{color-scheme:light;padding-block:env(safe-area-inset-top,0px) env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}';
  var CAR_SVG = '<svg viewBox="0 0 300 115" fill="none" aria-hidden="true"><ellipse cx="153" cy="95" rx="122" ry="5" fill="currentColor" opacity=".08"/><path d="M28 81v-14q0-9 11-12l38-8 35-25q6-4 16-4h56q14 0 27 14l20 20 30 7q13 3 15 14v10h-18m-41 1H91m-42-1H28" stroke="currentColor" stroke-width="1.2"/><path d="m89 48 30-22h63q9 0 20 11l14 15-127-4Zm68-22v24m-57 6-2 24m64-25v26m45-25 5 21M34 63l22-1-6 8H29m240-7-18-3 3 8 20 4M170 59h11m-66-2h10" stroke="currentColor" stroke-width=".8"/><path d="m38 56 45-7 151 6m-131 31 105-1" stroke="currentColor" stroke-width=".6" opacity=".4"/><circle cx="70" cy="82" r="20" fill="var(--ph-bg)" stroke="currentColor" stroke-width="1.4"/><circle cx="70" cy="82" r="12" stroke="currentColor" stroke-width=".7"/><circle cx="238" cy="82" r="20" fill="var(--ph-bg)" stroke="currentColor" stroke-width="1.4"/><circle cx="238" cy="82" r="12" stroke="currentColor" stroke-width=".7"/><path d="M70 70v24m-12-12h24m-20-8 16 16m0-16-16 16m176-20v24m-12-12h24m-20-8 16 16m0-16-16 16" stroke="currentColor" stroke-width=".5"/></svg>';

  var DATA;
  try { DATA = JSON.parse(document.getElementById('estoque-data').textContent); } catch (e) { DATA = { v: 1, items: [] }; }

  var state = { tab: 'venda', q: '', status: 'ativos', sort: 'recent', view: 'grid', items: DATA.items || [], canWrite: false, photoIdx: 0, openId: null, lastMod: 0 };
  var artifact = null;
  var cur = null;
  var draft = { fotos: [] };
  var lastFocus = null, saving = false, confirmDel = false, confirmEx = false, toastTimer = 0;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  var fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  var fmtNum = new Intl.NumberFormat('pt-BR');
  function brl(n) { return (n == null || n === '' || isNaN(n)) ? '—' : fmtBRL.format(n); }
  function kmTxt(n) { return (n == null || n === '' || isNaN(n)) ? '' : fmtNum.format(n) + ' km'; }
  function fotos(it) { return Array.isArray(it.fotos) ? it.fotos : []; }
  function cover(it) { return fotos(it)[0] || ''; }
  function find(id) { return state.items.filter(function (x) { return x.id === id; })[0] || null; }
  function title(it) { return esc(it.marca) + ' ' + esc(it.modelo); }
  function plainTitle(it) { return it.marca + ' ' + it.modelo + (it.ano ? ' ' + it.ano : ''); }
  function waLink(it) {
    var t = it
      ? 'Olá! Vi o ' + [it.marca, it.modelo, it.versao, it.ano].filter(Boolean).join(' ') + ' no site da R Motors e tenho interesse.'
      : 'Olá! Vim pelo site da R Motors.';
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(t);
  }
  function dateTxt(ts) {
    try { return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }); }
    catch (e) { return new Date(ts).toLocaleDateString('pt-BR'); }
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3600);
  }

  /* ---------- Publicação (só o dono) ---------- */
  function skeleton(content) {
    var reset = '';
    try {
      var sts = document.head.querySelectorAll('style');
      for (var i = 0; i < sts.length; i++) { if (sts[i].textContent.indexOf('[hidden]') >= 0) { reset = sts[i].textContent; break; } }
    } catch (e) {}
    if (!reset) reset = RESET_FALLBACK;
    return '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + reset + '</style></head><body>' + content + '</body></html>';
  }
  function sizeMB(items) { return buildContent({ v: 1, items: items }).length / (1024 * 1024); }

  async function commit(next, msg, tab) {
    if (!artifact) throw { code: 'not_granted' };
    var doc = skeleton(buildContent({ v: 1, items: next }));
    if (doc.length > LIMIT) throw { code: 'too_large' };
    try { sessionStorage.setItem('rm-flash', msg); if (tab) sessionStorage.setItem('rm-tab', tab); } catch (e) {}
    try {
      await artifact.publish(doc);
    } catch (e) {
      try { sessionStorage.removeItem('rm-flash'); } catch (x) {}
      throw e;
    }
    state.items = next;
    if (tab) state.tab = tab;
    render();
  }
  function publishError(e) {
    var c = e && e.code;
    if (c === 'conflict') return 'Outra versão do site foi publicada antes desta. A página vai recarregar: abra o veículo de novo e repita a alteração.';
    if (c === 'not_writer' || c === 'not_granted' || c === 'consent_required' || c === 'not_declared') { state.canWrite = false; render(); return 'Só o dono do site pode alterar o estoque.'; }
    if (c === 'too_large') return 'O site passou do limite de tamanho. Use menos fotos ou exclua veículos vendidos.';
    if (c === 'rate_limited') return 'Muitas alterações em pouco tempo. Aguarde alguns segundos e tente de novo.';
    return 'Não foi possível publicar agora. Tente de novo em instantes.';
  }

  /* ---------- Listas ---------- */
  function cmp(a, b) {
    if (state.sort === 'price-asc') return (a.preco || 0) - (b.preco || 0);
    if (state.sort === 'price-desc') return (b.preco || 0) - (a.preco || 0);
    if (state.sort === 'year') return (b.ano || 0) - (a.ano || 0);
    var r = (RANK[a.status] || 0) - (RANK[b.status] || 0);
    if (r) return r;
    return (b.createdAt || 0) - (a.createdAt || 0);
  }
  function visible() {
    var q = norm(state.q);
    return state.items.filter(function (i) {
      if (i.tipo !== state.tab) return false;
      if (state.status === 'ativos') { if (i.status === 'vendido') return false; }
      else if (state.status !== 'all' && i.status !== state.status) return false;
      if (!q) return true;
      return norm([i.marca, i.modelo, i.versao, i.cor, i.placa, i.ano].join(' ')).indexOf(q) >= 0;
    }).sort(cmp);
  }
  function placeholder(compact) {
    return '<div class="noimg' + (compact ? ' compact' : '') + '" role="img" aria-label="Sem foto">' + CAR_SVG + '<span>Fotos em breve</span></div>';
  }
  function pill(st) { return '<span class="pill st-' + esc(st) + '">' + esc(STATUS[st] || 'Disponível') + '</span>'; }
  function deltaInfo(it) {
    if (!it.fipe || it.preco == null) return null;
    var p = (it.preco / it.fipe - 1) * 100;
    return { p: p, txt: (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(1).replace('.', ',') + '% da FIPE' };
  }
  function deltaHTML(it) { var d = deltaInfo(it); return d ? '<span class="delta' + (d.p < 0 ? ' neg' : '') + '">' + d.txt + '</span>' : ''; }
  function editBtn(it) {
    return state.canWrite ? '<button class="round" type="button" aria-label="Editar ' + title(it) + '" title="Editar veículo" data-edit="' + esc(it.id) + '"><svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg></button>' : '';
  }
  function openBtn(it) {
    return '<button class="round" type="button" aria-label="Ver detalhes de ' + title(it) + '" title="Ver detalhes" data-open="' + esc(it.id) + '"><svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button>';
  }

  function cardHTML(it, i) {
    var f = cover(it);
    var img = f ? '<img loading="lazy" alt="' + esc(plainTitle(it)) + '" src="' + esc(f) + '">' : placeholder(false);
    var specs = [it.ano, kmTxt(it.km), it.cambio, it.comb, it.cor].filter(function (x) { return x !== '' && x != null; });
    return '<article class="card ' + esc(it.status) + '" data-open="' + esc(it.id) + '" style="animation-delay:' + (Math.min(i, 8) * 0.05) + 's">' +
      '<div class="ph">' + img + '<div class="badges">' + pill(it.status) + (it.exemplo ? '<span class="tag">Exemplo</span>' : '') + '</div></div>' +
      '<div class="body"><div class="make-label">' + esc(it.marca) + '</div><h3><button type="button" data-open="' + esc(it.id) + '">' + esc(it.modelo) + '</button></h3>' +
      (it.versao ? '<p class="ver">' + esc(it.versao) + '</p>' : '<p class="ver"></p>') +
      '<ul class="specs">' + specs.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<div class="foot"><div><div class="price-label">Valor de venda</div><div class="price">' + brl(it.preco) + '</div></div>' +
      '<div class="foot-act">' + editBtn(it) + openBtn(it) + '</div></div></div></article>';
  }

  function rowHTML(it) {
    var f = cover(it);
    var thumb = f ? '<img class="thumb" loading="lazy" alt="' + esc(plainTitle(it)) + '" src="' + esc(f) + '">' : '<div class="thumbph">' + placeholder(true) + '</div>';
    return '<tr class="' + esc(it.status) + '" data-open="' + esc(it.id) + '">' +
      '<td>' + thumb + '</td>' +
      '<td><div class="vname">' + title(it) + (it.exemplo ? ' <span class="tag">Exemplo</span>' : '') + '</div>' +
      '<div class="vsub">' + esc([it.versao, it.cambio, it.comb].filter(Boolean).join(' · ')) + '</div></td>' +
      '<td class="num">' + esc(it.ano || '—') + '</td>' +
      '<td class="num">' + esc(kmTxt(it.km) || '—') + '</td>' +
      '<td>' + esc(it.cor || '—') + '</td>' +
      '<td><span class="plate">' + esc(it.placa || '—') + '</span></td>' +
      '<td class="num">' + brl(it.fipe) + '</td>' +
      '<td class="num"><span class="rprice">' + brl(it.preco) + '</span>' + deltaHTML(it) + '</td>' +
      '<td>' + pill(it.status) + '</td>' +
      '<td><div class="foot-act">' + editBtn(it) + openBtn(it) + '</div></td></tr>';
  }

  function rpItemHTML(it) {
    var f = cover(it);
    var thumb = f ? '<img loading="lazy" alt="' + esc(plainTitle(it)) + '" src="' + esc(f) + '">' : placeholder(true);
    var meta = [it.ano, kmTxt(it.km), it.cor, it.placa].filter(function (x) { return x !== '' && x != null; });
    var d = deltaInfo(it);
    return '<article class="rp-item ' + esc(it.status) + '" data-open="' + esc(it.id) + '">' +
      '<div class="rp-img">' + thumb + '</div>' +
      '<div><div class="vname">' + title(it) + (it.exemplo ? ' <span class="tag">Exemplo</span>' : '') + '</div><div class="vsub">' + esc([it.versao, it.cambio].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="rp-meta">' + meta.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div>' +
      '<div class="rp-row"><div><span class="rprice">' + brl(it.preco) + '</span>' + (d ? '<span class="delta' + (d.p < 0 ? ' neg' : '') + '">' + d.txt + '</span>' : '') + '</div>' +
      '<div class="foot-act">' + pill(it.status) + editBtn(it) + '</div></div></article>';
  }

  function render() {
    var act = function (t) { return state.items.filter(function (i) { return i.tipo === t && i.status !== 'vendido'; }).length; };
    var nV = act('venda'), nR = act('repasse');
    $('n-venda').textContent = nV; $('n-repasse').textContent = nR;
    ['venda', 'repasse'].forEach(function (t) {
      $('tab-' + t).setAttribute('aria-selected', state.tab === t ? 'true' : 'false');
      $('tab-' + t).tabIndex = state.tab === t ? 0 : -1;
    });
    $('list').setAttribute('aria-labelledby', 'tab-' + state.tab);
    $('view-controls').hidden = state.tab === 'repasse';
    $('view-grid').setAttribute('aria-pressed', String(state.view === 'grid'));
    $('view-list').setAttribute('aria-pressed', String(state.view === 'list'));

    $('st-venda').textContent = fmtNum.format(nV);
    $('st-repasse').textContent = fmtNum.format(nR);
    $('st-disp').textContent = fmtNum.format(state.items.filter(function (i) { return i.status === 'disponivel'; }).length);
    var last = 0;
    state.items.forEach(function (i) { var t = i.updatedAt || i.createdAt || 0; if (t > last) last = t; });
    var shown = state.lastMod || last;
    $('st-date').textContent = shown ? dateTxt(shown) : '—';

    renderAdmin();

    var rows = visible();
    var avail = rows.filter(function (i) { return i.status === 'disponivel'; }).length;
    var list = $('list');
    var sum = '<b>' + rows.length + '</b> ' + (rows.length === 1 ? 'veículo' : 'veículos') + ' · <b>' + avail + '</b> ' + (avail === 1 ? 'disponível' : 'disponíveis');
    if (state.canWrite) sum += ' · <b>' + rows.filter(function (i) { return !fotos(i).length; }).length + '</b> sem foto';
    $('summary').innerHTML = sum;

    if (!rows.length) {
      var filtered = state.q || state.status !== 'ativos';
      var any = state.items.some(function (i) { return i.tipo === state.tab; });
      var name = state.tab === 'venda' ? 'à venda' : 'em repasse';
      list.innerHTML = filtered && any
        ? '<div class="empty"><strong>Nada encontrado</strong>Ajuste a busca ou a situação para ver outros veículos.</div>'
        : '<div class="empty"><strong>Nenhum veículo ' + name + ' agora</strong>' +
          (state.canWrite ? 'Use “Novo veículo” para cadastrar o primeiro.' : 'Chame a gente no WhatsApp e conte o que você procura.') + '</div>';
      return;
    }
    if (state.tab === 'venda') {
      list.innerHTML = '<div class="' + (state.view === 'grid' ? 'grid-cards' : 'list-view') + '">' + rows.map(cardHTML).join('') + '</div>';
    } else {
      list.innerHTML = '<div class="only-wide"><div class="tablewrap" tabindex="0" role="region" aria-label="Tabela de repasse, role para ver todas as colunas"><table><thead><tr>' +
        '<th>Foto</th><th>Veículo</th><th class="num">Ano</th><th class="num">KM</th><th>Cor</th><th>Placa</th>' +
        '<th class="num">FIPE</th><th class="num">Repasse</th><th>Situação</th><th><span class="sr">Ações</span></th>' +
        '</tr></thead><tbody>' + rows.map(rowHTML).join('') + '</tbody></table></div></div>' +
        '<div class="rp-list">' + rows.map(rpItemHTML).join('') + '</div>';
    }
  }

  function renderAdmin() {
    var bar = $('admin-bar');
    bar.hidden = !state.canWrite;
    if (!state.canWrite) return;
    var ex = state.items.filter(function (i) { return i.exemplo; }).length;
    var mb = sizeMB(state.items);
    $('ab-text').innerHTML = '<b>Modo de edição.</b> Só você vê esta barra; os clientes veem o site normalmente.' +
      '<span>' + state.items.length + ' veículos · site com ' + mb.toFixed(1).replace('.', ',') + ' MB de 16 MB' +
      (ex ? ' · ' + ex + (ex === 1 ? ' exemplo para substituir' : ' exemplos para substituir') : '') + '</span>';
    $('rm-ex').hidden = !ex;
    $('rm-ex').textContent = confirmEx ? 'Confirmar: remover ' + ex : 'Remover exemplos';
  }

  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || t.closest('#photos-grid') || t.closest('.d-main') || t.closest('.d-thumbs')) return;
    var compact = t.classList.contains('thumb') || !!t.closest('.rp-img');
    var holder = document.createElement('div');
    holder.innerHTML = placeholder(compact);
    t.replaceWith(holder.firstChild);
  }, true);

  /* ---------- Detalhes (clientes) ---------- */
  function drawDetail(it) {
    var fs = fotos(it), idx = Math.min(state.photoIdx, Math.max(0, fs.length - 1));
    var main = fs.length ? '<img alt="' + esc(plainTitle(it)) + ', foto ' + (idx + 1) + '" src="' + esc(fs[idx]) + '">' : placeholder(false);
    var thumbs = fs.length > 1 ? '<div class="d-thumbs">' + fs.map(function (f, i) {
      return '<button type="button" data-ph="' + i + '" aria-label="Ver foto ' + (i + 1) + '"' + (i === idx ? ' aria-current="true"' : '') + '><img alt="" src="' + esc(f) + '"></button>';
    }).join('') + '</div>' : '';
    var specs = [['Ano', it.ano], ['Quilometragem', kmTxt(it.km)], ['Cor', it.cor], ['Câmbio', it.cambio], ['Combustível', it.comb], ['Placa', it.placa]]
      .filter(function (s) { return s[1] !== '' && s[1] != null; });
    var d = deltaInfo(it);
    var fipe = it.tipo === 'repasse' && it.fipe ? '<div class="d-fipe">FIPE ' + brl(it.fipe) + (d ? ' · <span class="' + (d.p < 0 ? 'neg' : '') + '">' + d.txt + '</span>' : '') + '</div>' : '';
    var sold = it.status === 'vendido';
    $('detail').innerHTML =
      '<div class="d-gallery"><div class="d-main">' + main + '</div>' + thumbs + '</div>' +
      '<div class="d-body"><div class="d-top"><div><div class="make-label">' + esc(it.marca) + '</div><h2 id="d-title">' + esc(it.modelo) + '</h2>' + (it.versao ? '<p class="ver">' + esc(it.versao) + '</p>' : '') + '</div>' + pill(it.status) + '</div>' +
      '<div><div class="price-label">' + (it.tipo === 'repasse' ? 'Valor de repasse' : 'Valor de venda') + '</div><div class="d-price">' + brl(it.preco) + '</div>' + fipe + '</div>' +
      '<dl class="d-specs">' + specs.map(function (s) { return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' +
      (it.obs ? '<p class="d-obs">' + esc(it.obs) + '</p>' : '') +
      '<div class="d-cta">' +
      (sold
        ? '<p class="hint">Este veículo já foi vendido. Fale com a gente para encontrar um parecido.</p><a class="btn primary" href="' + waLink(null) + '" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="#i-chat"/></svg>Procurar outro carro</a>'
        : '<a class="btn primary" href="' + waLink(it) + '" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="#i-chat"/></svg>Tenho interesse neste carro</a>') +
      '<p class="hint">WhatsApp ' + PHONE_TXT + (it.exemplo ? ' · Veículo de exemplo' : '') + '</p></div></div>' +
      '<button class="icon-btn d-close" type="button" id="d-close" aria-label="Fechar detalhes"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>';
  }
  function openDetail(id) {
    var it = find(id);
    if (!it) return;
    state.openId = id; state.photoIdx = 0;
    lastFocus = document.activeElement;
    drawDetail(it);
    $('ov-detail').hidden = false;
    document.body.style.overflow = 'hidden';
    $('d-close').focus();
  }
  function closeDetail() {
    $('ov-detail').hidden = true;
    state.openId = null;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* ---------- Formulário (dono) ---------- */
  function setTipo(t) {
    $('f-tipo-' + t).checked = true;
    $('w-fipe').hidden = t !== 'repasse';
    $('l-preco').textContent = t === 'repasse' ? 'Valor de repasse (R$) *' : 'Preço de venda (R$) *';
  }
  function val(id) { return $(id).value.trim(); }
  function numOrNull(id) { var v = val(id); return v === '' ? null : Number(v); }
  function showErr(msg) { var e = $('err'); e.textContent = msg || ''; e.hidden = !msg; }
  function renderPhotos() {
    $('photos-grid').innerHTML = draft.fotos.map(function (src, i) {
      return '<div class="ph-item"><img alt="Foto ' + (i + 1) + '" src="' + esc(src) + '">' + (i === 0 ? '<span class="cover-tag">Capa</span>' : '') +
        '<div class="ph-tools">' + (i === 0 ? '<span></span>' : '<button type="button" data-cover="' + i + '">Capa</button>') + '<button type="button" data-rmfoto="' + i + '">Remover</button></div></div>';
    }).join('');
    $('foto-pick').disabled = draft.fotos.length >= MAX_FOTOS;
  }
  function openForm(id) {
    cur = id ? find(id) : null;
    lastFocus = document.activeElement;
    confirmDel = false; saving = false;
    var c = cur || { tipo: state.tab, status: 'disponivel' };
    draft = { fotos: fotos(c).slice() };
    $('dlg-title').textContent = cur ? 'Editar veículo' : 'Novo veículo';
    setTipo(c.tipo || 'venda');
    var map = { 'f-marca': 'marca', 'f-modelo': 'modelo', 'f-versao': 'versao', 'f-ano': 'ano', 'f-km': 'km', 'f-cor': 'cor', 'f-cambio': 'cambio', 'f-comb': 'comb', 'f-placa': 'placa', 'f-preco': 'preco', 'f-fipe': 'fipe', 'f-status': 'status', 'f-obs': 'obs' };
    Object.keys(map).forEach(function (k) { $(k).value = c[map[k]] == null ? '' : c[map[k]]; });
    $('f-foto').value = '';
    $('del').disabled = false; $('del').hidden = !cur; $('del').textContent = 'Excluir veículo';
    $('save').disabled = false; $('save').textContent = 'Salvar e publicar';
    showErr('');
    renderPhotos();
    $('overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    $('f-marca').focus();
  }
  function closeForm() {
    $('overlay').hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function readPhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1200 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.76));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  async function addPhotos(files) {
    var room = MAX_FOTOS - draft.fotos.length;
    var list = Array.prototype.slice.call(files, 0, room);
    if (files.length > room) showErr('Limite de ' + MAX_FOTOS + ' fotos por veículo. As demais foram ignoradas.'); else showErr('');
    $('foto-pick').disabled = true;
    for (var i = 0; i < list.length; i++) {
      try { draft.fotos.push(await readPhoto(list[i])); }
      catch (e) { showErr('Não foi possível usar uma das fotos. Escolha imagens JPG, PNG ou WebP.'); }
    }
    renderPhotos();
  }

  async function submit(ev) {
    ev.preventDefault();
    if (saving) return;
    var tipo = $('f-tipo-repasse').checked ? 'repasse' : 'venda';
    var marca = val('f-marca'), modelo = val('f-modelo');
    var ano = numOrNull('f-ano'), preco = numOrNull('f-preco'), km = numOrNull('f-km'), fipe = numOrNull('f-fipe');
    if (!marca || !modelo) return showErr('Informe a marca e o modelo.');
    if (ano == null || ano < 1950 || ano > 2100) return showErr('Informe o ano do veículo com quatro dígitos.');
    if (preco == null || preco < 0) return showErr('Informe o valor do veículo.');
    if ((km != null && km < 0) || (fipe != null && fipe < 0)) return showErr('Quilometragem e FIPE não podem ser negativas.');
    var now = Date.now();
    var it = {
      id: cur ? cur.id : 'v' + now.toString(36) + Math.random().toString(36).slice(2, 6),
      tipo: tipo, marca: marca, modelo: modelo, versao: val('f-versao'), ano: ano, km: km, cor: val('f-cor'),
      cambio: $('f-cambio').value, comb: $('f-comb').value, placa: val('f-placa').toUpperCase(),
      preco: preco, fipe: tipo === 'repasse' ? fipe : null, status: $('f-status').value, obs: val('f-obs'),
      fotos: draft.fotos.slice(), createdAt: cur && cur.createdAt ? cur.createdAt : now, updatedAt: now
    };
    var next = state.items.slice();
    var idx = cur ? next.findIndex(function (x) { return x.id === cur.id; }) : -1;
    if (idx >= 0) next[idx] = it; else next.unshift(it);
    saving = true; showErr('');
    $('save').disabled = true; $('save').textContent = 'Publicando…';
    try {
      await commit(next, cur ? 'Veículo atualizado e publicado.' : 'Veículo cadastrado e publicado.', tipo);
      closeForm();
    } catch (e) {
      saving = false; $('save').disabled = false; $('save').textContent = 'Salvar e publicar';
      showErr(publishError(e));
    }
  }
  async function doDelete() {
    if (!cur || saving) return;
    if (!confirmDel) { confirmDel = true; $('del').textContent = 'Confirmar exclusão'; return; }
    saving = true; $('del').disabled = true;
    var id = cur.id;
    try {
      await commit(state.items.filter(function (x) { return x.id !== id; }), 'Veículo excluído.');
      closeForm();
    } catch (e) { showErr(publishError(e)); }
    saving = false; $('del').disabled = false;
  }
  async function removeExamples() {
    if (!confirmEx) { confirmEx = true; renderAdmin(); setTimeout(function () { confirmEx = false; renderAdmin(); }, 5000); return; }
    confirmEx = false;
    try { await commit(state.items.filter(function (x) { return !x.exemplo; }), 'Exemplos removidos.'); }
    catch (e) { toast(publishError(e)); renderAdmin(); }
  }

  /* ---------- Eventos ---------- */
  function setTab(t, scroll) {
    state.tab = t;
    try { sessionStorage.setItem('rm-tab', t); } catch (e) {}
    try { location.hash = t === 'repasse' ? 'repasse' : 'vendas'; } catch (e) {}
    render();
    if (scroll) { var s = $('estoque'); if (s && s.scrollIntoView) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  function route() {
    var h = (location.hash || '').slice(1);
    var t = h === 'repasse' ? 'repasse' : h === 'vendas' ? 'venda' : null;
    if (t && t !== state.tab) { state.tab = t; render(); }
  }
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) setTab(b.getAttribute('data-tab'), false);
  });
  document.querySelector('.tabs').addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
    e.preventDefault();
    var next = e.key === 'Home' ? 'venda' : e.key === 'End' ? 'repasse' : state.tab === 'venda' ? 'repasse' : 'venda';
    setTab(next, false); $('tab-' + next).focus();
  });
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-go'), true); });
  });
  window.addEventListener('hashchange', route);
  $('q').addEventListener('input', function () { state.q = this.value; render(); });
  $('fstatus').addEventListener('change', function () { state.status = this.value; render(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; render(); });
  function setView(v) { state.view = v; try { localStorage.setItem('rmotors-view', v); } catch (e) {} render(); }
  $('view-grid').addEventListener('click', function () { setView('grid'); });
  $('view-list').addEventListener('click', function () { setView('list'); });

  $('list').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-edit]');
    if (ed) { e.stopPropagation(); openForm(ed.getAttribute('data-edit')); return; }
    var op = e.target.closest('[data-open]');
    if (op) openDetail(op.getAttribute('data-open'));
  });
  $('detail').addEventListener('click', function (e) {
    if (e.target.closest('#d-close')) { closeDetail(); return; }
    var p = e.target.closest('[data-ph]');
    if (p) { state.photoIdx = Number(p.getAttribute('data-ph')); var it = find(state.openId); if (it) { drawDetail(it); var nb = $('detail').querySelector('[data-ph="' + state.photoIdx + '"]'); if (nb) nb.focus(); } }
  });
  $('ov-detail').addEventListener('mousedown', function (e) { if (e.target === this) closeDetail(); });

  $('new').addEventListener('click', function () { openForm(null); });
  $('rm-ex').addEventListener('click', removeExamples);
  $('form').addEventListener('submit', submit);
  $('x').addEventListener('click', closeForm);
  $('cancel').addEventListener('click', closeForm);
  $('del').addEventListener('click', doDelete);
  $('overlay').addEventListener('mousedown', function (e) { if (e.target === this && !saving) closeForm(); });
  document.querySelectorAll('input[name="tipo"]').forEach(function (r) { r.addEventListener('change', function () { setTipo(this.value); }); });
  $('foto-pick').addEventListener('click', function () { $('f-foto').click(); });
  $('f-foto').addEventListener('change', function () { if (this.files && this.files.length) addPhotos(this.files).then(function () { $('f-foto').value = ''; }); });
  $('photos-grid').addEventListener('click', function (e) {
    var c = e.target.closest('[data-cover]'), r = e.target.closest('[data-rmfoto]');
    if (c) { var i = Number(c.getAttribute('data-cover')); var f = draft.fotos.splice(i, 1)[0]; draft.fotos.unshift(f); renderPhotos(); }
    if (r) { draft.fotos.splice(Number(r.getAttribute('data-rmfoto')), 1); renderPhotos(); }
  });

  document.addEventListener('keydown', function (e) {
    var formOpen = !$('overlay').hidden, detailOpen = !$('ov-detail').hidden;
    if (!formOpen && !detailOpen) return;
    if (e.key === 'Escape') { if (formOpen) { if (!saving) closeForm(); } else closeDetail(); return; }
    if (e.key === 'Tab') {
      var root = formOpen ? $('form') : $('detail');
      var nodes = Array.prototype.filter.call(root.querySelectorAll('button, a[href], input, select, textarea'), function (el) {
        return !el.disabled && el.getClientRects().length && !el.closest('[hidden]') && el.type !== 'file';
      });
      if (!nodes.length) return;
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  $('copy-phone').addEventListener('click', function () {
    function fallback() {
      try { var r = document.createRange(); r.selectNodeContents($('phone-text')); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (x) {}
      toast('Número selecionado. Copie com o menu do seu aparelho.');
    }
    try { navigator.clipboard.writeText('48999583069').then(function () { toast('Número copiado.'); }, fallback); } catch (e) { fallback(); }
  });

  function isLight() {
    var t = document.documentElement.dataset.theme;
    if (t) return t === 'light';
    try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) { return false; }
  }
  function syncTheme() {
    var light = isLight(), b = $('theme-toggle');
    b.setAttribute('aria-label', light ? 'Ativar tema escuro' : 'Ativar tema claro');
    b.title = light ? 'Ativar tema escuro' : 'Ativar tema claro';
    b.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-' + (light ? 'moon' : 'sun') + '"/></svg>';
  }
  $('theme-toggle').addEventListener('click', function () {
    var next = isLight() ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('rmotors-theme', next); } catch (e) {}
    syncTheme();
  });

  /* ---------- Início ---------- */
  ['hdr-wa', 'hero-wa', 'ct-wa', 'fab-wa'].forEach(function (id) { $(id).href = waLink(null); });
  try { var st = localStorage.getItem('rmotors-theme'); if (st === 'light' || st === 'dark') document.documentElement.dataset.theme = st; } catch (e) {}
  try { if (localStorage.getItem('rmotors-view') === 'list') state.view = 'list'; } catch (e) {}
  try { var t0 = sessionStorage.getItem('rm-tab'); if (t0 === 'venda' || t0 === 'repasse') state.tab = t0; } catch (e) {}
  syncTheme();
  route();
  render();
  try { var fl = sessionStorage.getItem('rm-flash'); if (fl) { sessionStorage.removeItem('rm-flash'); toast(fl); } } catch (e) {}

  /* Hospedagem estática (GitHub Pages): lê o estoque do arquivo estoque.json */
  (function loadStatic() {
    if (window.claude && window.claude.use) return;
    if (!/^https?:$/.test(location.protocol)) return;
    fetch('estoque.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      var lm = Date.parse(r.headers.get('last-modified') || '');
      return r.json().then(function (j) { return { j: j, lm: lm }; });
    }).then(function (o) {
      if (!o.j || !Array.isArray(o.j.items)) return;
      state.items = o.j.items;
      state.lastMod = isNaN(o.lm) ? 0 : o.lm;
      render();
    }).catch(function () {});
  })();

  (async function init() {
    try {
      if (!(window.claude && window.claude.use)) return;
      var r = await Promise.all([window.claude.use('artifact'), window.claude.use('user')]);
      var a = r[0], u = r[1];
      if (!a || !u) return;
      var ok = false;
      try { ok = !!(await u.canEdit()) || !!(await u.isOwner()); } catch (e) {}
      if (ok) { artifact = a; state.canWrite = true; render(); }
    } catch (e) {}
  })();
})();
