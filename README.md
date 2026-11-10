# Rmotors
Loja de automoveis 

## Site (GitHub Pages)

O site é a página `index.html`, que lê os veículos do arquivo `estoque.json`.

**Atualizar o estoque:** edite o `estoque.json` aqui no GitHub (ícone de lápis) e salve com *Commit changes*.
Em 1 ou 2 minutos o site mostra a mudança. Cada veículo tem `tipo` (`venda` ou `repasse`), `marca`, `modelo`,
`versao`, `ano`, `km`, `cor`, `cambio`, `comb`, `placa`, `preco`, `fipe` (só repasse), `status`
(`disponivel`, `reservado` ou `vendido`), `obs` e `fotos`. Os veículos com `"exemplo": true` são de demonstração.

**Fotos:** envie os arquivos para uma pasta `fotos/` e liste os caminhos em `fotos`, por exemplo `["fotos/t-cross-1.jpg"]`.

**Código:** o código-fonte está em `src/`. Depois de mudar algo ali, rode `node build.mjs` para gerar `index.html` de novo.
