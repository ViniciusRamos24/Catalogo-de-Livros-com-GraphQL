# Meu Catálogo de Livros — GraphQL

Projeto completo do exercício, com interface simples em formato de tabela: **schema SDL, backend FastAPI + Strawberry, front-end HTML/CSS/JavaScript, queries, mutations, validações, dados iniciais e respostas teóricas**.

## Estrutura

```text
catalogo-livros-graphql/
├── schema.graphql             # Parte 1: modelagem SDL
├── catalogo-api/
│   ├── main.py                # Parte 2: servidor GraphQL
│   └── requirements.txt       # Dependências do backend
├── catalogo-web/
│   ├── index.html             # Parte 3: interface
│   ├── styles.css
│   └── app.js
├── tests/
│   └── test_api.py           # Testes das regras de negócio
├── requirements-dev.txt
├── respostas.md              # Questões 1, 2, 3, 9, 10, 11 e 12
└── README.md
```

## Requisitos

- Python **3.10 ou superior** e `pip`.
- Navegador atualizado.
- Conexão com a internet para instalar as dependências na primeira execução.

## Como executar no Windows (PowerShell) — apenas um servidor

Na pasta `catalogo-api` execute:

```powershell
cd catalogo-api
py -m pip install -r requirements.txt
py -m uvicorn main:app --reload
```

Abra no navegador:
- **Aplicação completa:** http://127.0.0.1:8000
- **GraphiQL:** http://127.0.0.1:8000/graphql

**Não é necessário executar `py -m http.server 5500`.** O próprio FastAPI serve os arquivos HTML, CSS e JavaScript da interface.

Se o comando `py` não funcionar, experimente `python` no lugar. Se a política da faculdade bloquear **Python ou a abertura de servidores locais**, pode ser necessária autorização de TI ou executar o projeto em um computador pessoal. Não é preciso ter permissão de administrador apenas para usar uma porta local acima de 1024 quando o Python já está disponível.

**Alternativa para abrir a interface:** também é possível dar duplo clique em `catalogo-web/index.html` sem o segundo servidor, mas **a API na porta 8000 ainda precisa estar rodando** para os dados funcionarem.

## Como executar no Linux/macOS

Na pasta `catalogo-api`:

```bash
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --reload
```

Abra http://127.0.0.1:8000.

## Exemplos para testar no GraphiQL

**Consulta com filtro, estatísticas e autores:**

```graphql
query {
  books(status: FINISHED, search: "dom") {
    title
    rating
    author { name }
  }
  stats { totalBooks finishedBooks averageRating totalPagesRead }
  authors { name bookCount }
}
```

**Consulta por ID:**

```graphql
query {
  book(id: 1) {
    id title year pages status rating
    author { name country }
  }
}
```

**Cadastrar autor:**

```graphql
mutation {
  addAuthor(input: {name: "J. R. R. Tolkien", country: "Reino Unido"}) {
    id name bookCount
  }
}
```

**Cadastrar livro:**

```graphql
mutation {
  addBook(input: {title: "O Hobbit", year: 1937, pages: 310, authorId: 3}) {
    id title status author { name }
  }
}
```

**Alterar status:**

```graphql
mutation {
  updateBookStatus(id: 3, status: FINISHED) { id title status }
}
```

**Avaliar um livro lido:**

```graphql
mutation {
  rateBook(id: 1, rating: 5) { id rating }
}
```

**Excluir livro:**

```graphql
mutation {
  deleteBook(id: 6)
}
```

**Validação — deve produzir erro GraphQL:**

```graphql
mutation {
  rateBook(id: 1, rating: 9) { id rating }
}
```

## Validações implementadas

- Título em branco ou somente espaços.
- Ano maior que o ano atual.
- Páginas menores que 1.
- `authorId` inexistente.
- Nota fora de 1 a 5.
- Tentar avaliar livro que ainda não está `FINISHED`.
- Atualizar status ou excluir livro com ID inexistente.

A interface apresenta mensagens de erro retornadas pelo GraphQL. O campo **Avaliação** só fica disponível para livros finalizados.

## Estatísticas

- `totalBooks`: número de livros cadastrados.
- `finishedBooks`: número de livros com status `FINISHED`.
- `averageRating`: média dos livros avaliados (ou `null` se não houver notas).
- `totalPagesRead`: soma das páginas dos livros finalizados (considerando que foram lidos integralmente).

## Desafio extra escolhido

A busca por título utiliza **debounce de 300 ms**, evitando enviar uma requisição para cada tecla digitada.

## Testes automatizados (opcional)

Na raiz do projeto, com o ambiente virtual do backend ativo:

```bash
pip install -r requirements-dev.txt
pytest -q
```

## Observações

- Os dados ficam **somente em memória** e retornam aos 3 autores e 6 livros iniciais ao reiniciar o backend.
- O backend gera o schema GraphQL a partir das classes Strawberry; `schema.graphql` apresenta a modelagem SDL equivalente.
- A interface consome as informações de livros, autores e estatísticas em **uma única requisição** para montar a tela principal.
- Não é usado banco de dados nem framework front-end, pois não são exigidos no enunciado.
