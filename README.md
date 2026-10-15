# i18n-check

CLI para comparar arquivos JSON de locales: aponta chaves ausentes e extras, variáveis de interpolação inconsistentes e traduções da base sem referência estática no código.

## Usar

Requer Node.js 20. Execute **npm install** e **npm run build**. Para usar em outro projeto, instale o repositório público:

    npm install --save-dev github:ulrichheringer/i18n-check

Depois rode:

    node dist/cli.js --locales ./locales --source ./src --base en

Use **--fail-on any** para falhar com qualquer achado, **--fail-on missing** para falhar apenas com traduções ausentes ou **--fail-on never** para apenas informar. O modo padrão falha se houver chaves ausentes, para que o comando possa encerrar com erro no CI.

Arquivos JSON planos e pastas por locale são aceitos. Chamadas dinâmicas de tradução não podem ser detectadas; o uso é identificado por chaves literais em chamadas t(), translate() e i18n.t().
