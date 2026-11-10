import fs from 'node:fs';

const dir = new URL('./', import.meta.url).pathname;
const read = (f) => fs.readFileSync(dir + 'src/' + f, 'utf8');

const BUILD_TS = Date.UTC(2026, 9, 31, 22, 40); // 31/10/2026 19:40 em São Paulo
const logo = read('logo.b64').trim();
const style = read('style.css').replace('__LOGO__', logo);
const body = read('body.html');
const app = read('app.js');

const S = [
  { tipo: 'venda', marca: 'Volkswagen', modelo: 'T-Cross', versao: '250 TSI Highline', ano: 2022, km: 38500, cor: 'Cinza', cambio: 'Automático', comb: 'Flex', placa: '', preco: 124900, status: 'disponivel' },
  { tipo: 'venda', marca: 'Fiat', modelo: 'Argo', versao: 'Drive 1.0', ano: 2021, km: 52300, cor: 'Branco', cambio: 'Manual', comb: 'Flex', placa: '', preco: 62900, status: 'disponivel' },
  { tipo: 'venda', marca: 'Toyota', modelo: 'Corolla', versao: 'XEi 2.0', ano: 2020, km: 71800, cor: 'Prata', cambio: 'CVT', comb: 'Flex', placa: '', preco: 109500, status: 'reservado' },
  { tipo: 'venda', marca: 'Chevrolet', modelo: 'Onix', versao: 'LT 1.0 Turbo', ano: 2019, km: 84100, cor: 'Preto', cambio: 'Automático', comb: 'Flex', placa: '', preco: 69900, status: 'vendido' },
  { tipo: 'repasse', marca: 'Hyundai', modelo: 'HB20', versao: 'Comfort 1.0', ano: 2018, km: 96400, cor: 'Branco', cambio: 'Manual', comb: 'Flex', placa: 'RTE2H47', preco: 41800, fipe: 44200, status: 'disponivel' },
  { tipo: 'repasse', marca: 'Renault', modelo: 'Kwid', versao: 'Zen 1.0', ano: 2020, km: 58200, cor: 'Vermelho', cambio: 'Manual', comb: 'Flex', placa: 'QXZ4F81', preco: 33900, fipe: 35100, status: 'disponivel' },
  { tipo: 'repasse', marca: 'Jeep', modelo: 'Renegade', versao: 'Sport 1.8', ano: 2017, km: 109800, cor: 'Cinza', cambio: 'Automático', comb: 'Flex', placa: 'PLM7C09', preco: 59900, fipe: 63500, status: 'reservado' },
  { tipo: 'repasse', marca: 'Honda', modelo: 'Civic', versao: 'EX 2.0', ano: 2016, km: 118000, cor: 'Preto', cambio: 'CVT', comb: 'Flex', placa: 'OKD3B56', preco: 71500, fipe: 74800, status: 'disponivel' },
  { tipo: 'repasse', marca: 'Ford', modelo: 'Ka', versao: 'SE 1.0', ano: 2019, km: 67500, cor: 'Prata', cambio: 'Manual', comb: 'Flex', placa: 'NJH9A32', preco: 38900, fipe: 40200, status: 'vendido' },
];
const items = S.map((s, i) => ({
  id: 'ex' + i, exemplo: true, ...s, obs: '', fotos: [],
  createdAt: BUILD_TS - i * 3600e3, updatedAt: BUILD_TS,
}));
const data = { v: 1, items };

// Quine: a página guarda [PRE, MID, POST] e remonta a si mesma com novos dados.
const PRE =
  '<title>R Motors</title>\n' +
  '<meta name="claude:viewport-fit-sides" content="cover">\n' +
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Manrope:wght@400;500;600;700&display=swap">\n' +
  '<style>\n' + style + '\n</style>\n' + body + '\n<script type="application/json" id="estoque-data">';
const MID = '</script>\n<script>\nvar TPL=';
const POST =
  ';\nfunction buildContent(d){' +
  'var j=function(s){return s.replace(/<\\//g,"<\\\\/").replace(/<!\\x2d\\x2d/g,"<\\\\!\\x2d\\x2d")};' +
  'return TPL[0]+JSON.stringify(d).replace(/</g,"\\\\u003c")+TPL[1]+j(JSON.stringify(TPL))+TPL[2]}\n' +
  '/*APP*/\n' + app + '\n</script>\n';

const TPL = [PRE, MID, POST];
const jsLit = (s) => s.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
const buildContent = (d) => TPL[0] + JSON.stringify(d).replace(/</g, '\\u003c') + TPL[1] + jsLit(JSON.stringify(TPL)) + TPL[2];

const page = buildContent(data);
fs.writeFileSync(dir + 'page.html', page);
fs.writeFileSync(dir + 'data0.json', JSON.stringify(data));
console.log('page.html', (page.length / 1024).toFixed(1) + ' KB');
