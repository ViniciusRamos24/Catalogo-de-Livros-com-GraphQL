# Respostas — Exercício: Catálogo de Livros com GraphQL

## Parte 1 — Perguntas de reflexão

**1. Por que `status` é melhor como enum do que como String?**  
O enum limita os valores possíveis a `WANT_TO_READ`, `READING` e `FINISHED`. Isso evita erros de digitação, facilita a validação e deixa o schema mais claro.

**2. Por que `rating` é opcional e `title` não?**  
Um livro pode ser cadastrado antes de ser lido e, portanto, ainda não ter uma nota. Já o título é necessário para identificar o livro no catálogo.

**3. `bookCount` deve ser armazenado ou calculado por um resolver? Justifique.**  
Deve ser calculado por um resolver, contando os livros associados ao autor. Assim, o valor permanece correto após cadastrar ou excluir livros, sem precisar atualizá-lo manualmente.

## Parte 4 — Análise

**9. Na tela principal, você precisa dos livros, dos autores e das estatísticas. Quantas requisições isso exigiria em uma API REST? Quantas você fez com GraphQL?**  
Em uma API REST com endpoints separados, seriam pelo menos três requisições: livros, autores e estatísticas. Neste projeto, o GraphQL reúne os três campos em uma única requisição ao endpoint `/graphql`.

**10. O que acontece quando uma mutation lança um erro? Qual o código HTTP da resposta e como o front descobre o problema?**  
O Strawberry captura a exceção e devolve a mensagem no campo `errors` da resposta GraphQL. Para erros de execução em uma requisição HTTP válida, normalmente retorna `200 OK`; outros problemas podem gerar códigos 4xx. O front verifica tanto o status HTTP quanto `errors` e exibe a mensagem recebida.

**11. Se `Author.books` fosse buscado do banco de dados para cada autor de uma lista de 100 autores, o que seria o problema N+1? Como um DataLoader ajudaria?**  
Seria feita uma consulta para listar os 100 autores e mais 100 consultas para buscar os livros de cada um: 101 consultas ao todo. Um DataLoader agrupa as buscas e carrega os livros de vários autores em lote, reduzindo a quantidade de consultas.

**12. Cite uma vantagem e uma desvantagem de ter um único endpoint (`/graphql`) para toda a API.**  
Vantagem: o cliente consulta diferentes informações em uma única chamada, solicitando apenas os campos necessários. Desvantagem: o monitoramento, o cache HTTP e a limitação de consultas complexas podem exigir mais cuidados que em endpoints REST separados.
