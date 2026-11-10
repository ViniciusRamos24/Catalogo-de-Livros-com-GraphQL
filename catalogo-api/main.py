"""Catálogo de livros: API GraphQL com FastAPI e Strawberry.

Os dados são armazenados somente em memória e reiniciam com o servidor.
O schema definido pelas classes corresponde ao arquivo ../schema.graphql.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from pathlib import Path

import strawberry
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from strawberry.fastapi import GraphQLRouter


@strawberry.enum
class ReadingStatus(Enum):
    WANT_TO_READ = "WANT_TO_READ"
    READING = "READING"
    FINISHED = "FINISHED"


@strawberry.type
class Book:
    id: int
    title: str
    year: int
    pages: int
    status: ReadingStatus
    rating: int | None
    author_id: strawberry.Private[int]

    @strawberry.field
    def author(self) -> Author:
        found = find_author(self.author_id)
        if found is None:
            raise ValueError("Autor do livro não encontrado.")
        return found


@strawberry.type
class Author:
    id: int
    name: str
    country: str | None

    @strawberry.field
    def books(self) -> list[Book]:
        return [book for book in books_data if book.author_id == self.id]

    @strawberry.field
    def book_count(self) -> int:
        return sum(book.author_id == self.id for book in books_data)


@strawberry.type
class Stats:
    total_books: int
    finished_books: int
    average_rating: float | None
    total_pages_read: int


@strawberry.input
class AuthorInput:
    name: str
    country: str | None = None


@strawberry.input
class BookInput:
    title: str
    year: int
    pages: int
    author_id: int


# Seed inicial: 3 autores e 6 livros.
authors_data: list[Author] = [
    Author(id=1, name="Machado de Assis", country="Brasil"),
    Author(id=2, name="Clarice Lispector", country="Brasil"),
    Author(id=3, name="George Orwell", country="Reino Unido"),
]

books_data: list[Book] = [
    Book(id=1, title="Dom Casmurro", year=1899, pages=256,
         status=ReadingStatus.FINISHED, rating=5, author_id=1),
    Book(id=2, title="Memórias Póstumas de Brás Cubas", year=1881, pages=208,
         status=ReadingStatus.FINISHED, rating=4, author_id=1),
    Book(id=3, title="A Hora da Estrela", year=1977, pages=96,
         status=ReadingStatus.READING, rating=None, author_id=2),
    Book(id=4, title="Perto do Coração Selvagem", year=1943, pages=208,
         status=ReadingStatus.WANT_TO_READ, rating=None, author_id=2),
    Book(id=5, title="1984", year=1949, pages=328,
         status=ReadingStatus.FINISHED, rating=5, author_id=3),
    Book(id=6, title="A Revolução dos Bichos", year=1945, pages=152,
         status=ReadingStatus.WANT_TO_READ, rating=None, author_id=3),
]

next_author_id = 4
next_book_id = 7


def find_author(author_id: int) -> Author | None:
    return next((author for author in authors_data if author.id == author_id), None)


def find_book(book_id: int) -> Book | None:
    return next((book for book in books_data if book.id == book_id), None)


def require_book(book_id: int) -> Book:
    book = find_book(book_id)
    if book is None:
        raise ValueError(f"Livro com ID {book_id} não encontrado.")
    return book


@strawberry.type
class Query:
    @strawberry.field
    def books(
        self,
        status: ReadingStatus | None = None,
        search: str | None = None,
    ) -> list[Book]:
        result = books_data
        if status is not None:
            result = [book for book in result if book.status == status]
        if search is not None and search.strip():
            term = search.strip().casefold()
            result = [book for book in result if term in book.title.casefold()]
        return result

    @strawberry.field
    def book(self, id: int) -> Book | None:
        return find_book(id)

    @strawberry.field
    def authors(self) -> list[Author]:
        return authors_data

    @strawberry.field
    def stats(self) -> Stats:
        finished = [book for book in books_data if book.status == ReadingStatus.FINISHED]
        ratings = [book.rating for book in books_data if book.rating is not None]
        return Stats(
            total_books=len(books_data),
            finished_books=len(finished),
            average_rating=(sum(ratings) / len(ratings)) if ratings else None,
            total_pages_read=sum(book.pages for book in finished),
        )


@strawberry.type
class Mutation:
    @strawberry.mutation
    def add_author(self, input: AuthorInput) -> Author:
        global next_author_id
        name = input.name.strip()
        if not name:
            raise ValueError("O nome do autor não pode estar vazio.")

        author = Author(
            id=next_author_id,
            name=name,
            country=(input.country or "").strip() or None,
        )
        authors_data.append(author)
        next_author_id += 1
        return author

    @strawberry.mutation
    def add_book(self, input: BookInput) -> Book:
        global next_book_id
        title = input.title.strip()
        if not title:
            raise ValueError("O título do livro não pode estar vazio.")
        if input.year > date.today().year:
            raise ValueError("O ano do livro não pode ser maior que o ano atual.")
        if input.pages < 1:
            raise ValueError("O número de páginas deve ser maior ou igual a 1.")
        if find_author(input.author_id) is None:
            raise ValueError(f"Autor com ID {input.author_id} não encontrado.")

        book = Book(
            id=next_book_id,
            title=title,
            year=input.year,
            pages=input.pages,
            status=ReadingStatus.WANT_TO_READ,
            rating=None,
            author_id=input.author_id,
        )
        books_data.append(book)
        next_book_id += 1
        return book

    @strawberry.mutation
    def update_book_status(self, id: int, status: ReadingStatus) -> Book:
        book = require_book(id)
        book.status = status
        # Um livro que deixou de estar lido não pode manter uma nota.
        if status != ReadingStatus.FINISHED:
            book.rating = None
        return book

    @strawberry.mutation
    def rate_book(self, id: int, rating: int) -> Book:
        if not 1 <= rating <= 5:
            raise ValueError("Nota inválida: a avaliação deve estar entre 1 e 5.")
        book = require_book(id)
        if book.status != ReadingStatus.FINISHED:
            raise ValueError("Só é possível avaliar um livro com status FINISHED (lido).")
        book.rating = rating
        return book

    @strawberry.mutation
    def delete_book(self, id: int) -> bool:
        book = require_book(id)
        books_data.remove(book)
        return True


schema = strawberry.Schema(query=Query, mutation=Mutation)

app = FastAPI(title="Meu Catálogo de Livros", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # desenvolvimento local; permite abrir index.html diretamente
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(GraphQLRouter(schema), prefix="/graphql")


# Serve a interface pelo mesmo servidor da API, sem precisar de outro http.server.
WEB_DIR = Path(__file__).resolve().parent.parent / "catalogo-web"
app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="frontend")
