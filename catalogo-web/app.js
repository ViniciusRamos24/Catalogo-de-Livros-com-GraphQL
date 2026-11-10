"use strict";

const API_URL = `${window.location.protocol === "file:" ? "http://127.0.0.1:8000" : window.location.origin}/graphql`;
const $ = (selector) => document.querySelector(selector);
const statusNames = {
  WANT_TO_READ: "Quero ler",
  READING: "Lendo",
  FINISHED: "Lido",
};

// Desafio extra escolhido: busca com debounce de 300 ms.
const CATALOG_QUERY = `
  query Catalogo($status: ReadingStatus, $search: String) {
    books(status: $status, search: $search) {
      id title year pages status rating
      author { id name }
    }
    authors { id name bookCount }
    stats { totalBooks finishedBooks averageRating totalPagesRead }
  }
`;

const ADD_BOOK = `
  mutation AdicionarLivro($input: BookInput!) {
    addBook(input: $input) { id title }
  }
`;
const ADD_AUTHOR = `
  mutation AdicionarAutor($input: AuthorInput!) {
    addAuthor(input: $input) { id name }
  }
`;
const UPDATE_STATUS = `
  mutation AtualizarStatus($id: Int!, $status: ReadingStatus!) {
    updateBookStatus(id: $id, status: $status) { id status rating }
  }
`;
const RATE_BOOK = `
  mutation AvaliarLivro($id: Int!, $rating: Int!) {
    rateBook(id: $id, rating: $rating) { id rating }
  }
`;
const DELETE_BOOK = `
  mutation ExcluirLivro($id: Int!) {
    deleteBook(id: $id)
  }
`;

/** Executa qualquer operação GraphQL e trata erros de rede, HTTP e do campo errors. */
async function gql(query, variables = {}) {
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new Error("Não foi possível conectar à API. Confira se o backend está rodando na porta 8000.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`A API respondeu com HTTP ${response.status}, mas não enviou um JSON válido.`);
  }

  const graphqlError = payload?.errors?.map((error) => error.message).join(" | ");
  if (!response.ok) {
    throw new Error(graphqlError || `Erro HTTP ${response.status}: ${response.statusText}`);
  }
  if (graphqlError) {
    throw new Error(graphqlError);
  }
  if (!payload || !Object.hasOwn(payload, "data")) {
    throw new Error("A resposta da API não contém dados.");
  }
  return payload.data;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function showError(message) {
  $("#success-message").hidden = true;
  $("#error-message").textContent = message;
  $("#error-message").hidden = false;
}

function showSuccess(message) {
  $("#error-message").hidden = true;
  $("#success-message").textContent = message;
  $("#success-message").hidden = false;
}

function hideFeedback() {
  $("#error-message").hidden = true;
  $("#success-message").hidden = true;
}

function renderStats(stats) {
  const number = (value) => new Intl.NumberFormat("pt-BR").format(value);
  $("#stat-total").textContent = number(stats.totalBooks);
  $("#stat-finished").textContent = number(stats.finishedBooks);
  $("#stat-rating").textContent = stats.averageRating === null
    ? "—" : stats.averageRating.toFixed(1).replace(".", ",");
  $("#stat-pages").textContent = number(stats.totalPagesRead);
}

function renderAuthors(authors) {
  const select = $("#book-author");
  const selected = select.value;
  select.innerHTML = '<option value="">Selecione um autor</option>' + authors
    .map((author) => `<option value="${author.id}">${escapeHTML(author.name)}</option>`)
    .join("");
  if (authors.some((author) => String(author.id) === selected)) {
    select.value = selected;
  }
}

function renderBooks(books) {
  $("#visible-count").textContent = `${books.length} ${books.length === 1 ? "livro" : "livros"}`;
  $("#empty-state").hidden = books.length > 0;
  $("#books-list").innerHTML = books.map((book) => {
    const statusOptions = Object.entries(statusNames).map(([key, label]) =>
      `<option value="${key}" ${book.status === key ? "selected" : ""}>${label}</option>`
    ).join("");
    const ratingOptions = [1, 2, 3, 4, 5].map((value) =>
      `<option value="${value}" ${book.rating === value ? "selected" : ""}>${value}</option>`
    ).join("");
    return `
      <tr>
        <td>
          <span class="book-title">${escapeHTML(book.title)}</span>
          <span class="book-author">${escapeHTML(book.author.name)}</span>
        </td>
        <td>${book.year}</td>
        <td>${book.pages}</td>
        <td>
          <select data-action="status" data-id="${book.id}" aria-label="Status de ${escapeHTML(book.title)}">
            ${statusOptions}
          </select>
        </td>
        <td>
          <select data-action="rating" data-id="${book.id}" aria-label="Nota de ${escapeHTML(book.title)}" ${book.status !== "FINISHED" ? "disabled" : ""}>
            <option value="" disabled ${book.rating === null ? "selected" : ""}>Sem nota</option>
            ${ratingOptions}
          </select>
        </td>
        <td><button class="delete-button" type="button" data-action="delete" data-id="${book.id}">Excluir</button></td>
      </tr>`;
  }).join("");
}

let requestVersion = 0;
async function loadCatalog() {
  const version = ++requestVersion;
  const status = $("#status-filter").value || null;
  const search = $("#search-input").value.trim() || null;
  $("#loading").hidden = false;
  try {
    const data = await gql(CATALOG_QUERY, { status, search });
    if (version !== requestVersion) return; // Ignora resultado de buscas anteriores.
    renderStats(data.stats);
    renderAuthors(data.authors);
    renderBooks(data.books);
    return true;
  } catch (error) {
    if (version === requestVersion) showError(error.message);
    return false;
  } finally {
    if (version === requestVersion) $("#loading").hidden = true;
  }
}

async function runMutation(query, variables, successMessage) {
  hideFeedback();
  try {
    const result = await gql(query, variables);
    const refreshed = await loadCatalog();
    if (refreshed) showSuccess(successMessage);
    return result;
  } catch (error) {
    showError(error.message);
    // Retorna os controles para o estado real do servidor quando possível.
    await loadCatalog();
    return null;
  }
}

$("#book-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const input = {
      title: $("#book-title").value,
      year: Number($("#book-year").value),
      pages: Number($("#book-pages").value),
      authorId: Number($("#book-author").value),
    };
    const result = await runMutation(ADD_BOOK, { input }, "Livro cadastrado com sucesso!");
    if (result) $("#book-form").reset();
  } finally {
    button.disabled = false;
  }
});

$("#author-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const input = {
      name: $("#author-name").value,
      country: $("#author-country").value.trim() || null,
    };
    const result = await runMutation(ADD_AUTHOR, { input }, "Autor cadastrado com sucesso!");
    if (result) {
      $("#author-form").reset();
      $("#book-author").value = String(result.addAuthor.id);
    }
  } finally {
    button.disabled = false;
  }
});

$("#books-list").addEventListener("change", async (event) => {
  const control = event.target;
  const id = Number(control.dataset.id);
  if (!id || !control.dataset.action) return;
  control.disabled = true;
  try {
    if (control.dataset.action === "status") {
      await runMutation(UPDATE_STATUS, { id, status: control.value }, "Status atualizado com sucesso!");
    } else if (control.dataset.action === "rating" && control.value) {
      await runMutation(RATE_BOOK, { id, rating: Number(control.value) }, "Avaliação registrada!");
    }
  } finally {
    if (control.isConnected) control.disabled = false;
  }
});

$("#books-list").addEventListener("click", async (event) => {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button) return;
  if (!window.confirm("Deseja realmente excluir este livro?")) return;
  button.disabled = true;
  try {
    await runMutation(DELETE_BOOK, { id: Number(button.dataset.id) }, "Livro excluído com sucesso!");
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});

let searchTimer;
$("#search-input").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadCatalog, 300);
});
$("#status-filter").addEventListener("change", () => {
  clearTimeout(searchTimer);
  loadCatalog();
});
$("#go-to-form").addEventListener("click", () => {
  $("#book-form-section").scrollIntoView({ behavior: "smooth" });
  $("#book-title").focus({ preventScroll: true });
});
$("#book-year").max = String(new Date().getFullYear());

loadCatalog();
