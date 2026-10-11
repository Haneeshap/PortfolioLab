# ADR-001: Initial Application Architecture

**Status:** Accepted  
**Date:** 2026-10-11

## Context

PortfolioLab is an educational fintech simulation designed to teach full-stack engineering through practical implementation.

The application requires a frontend, backend business logic, persistent storage, and eventually real-time updates.

## Decision

We will begin with three main components:

1. **Next.js frontend** for the user interface.
2. **Spring Boot backend** for REST APIs, business rules, and transaction processing.
3. **PostgreSQL database** for persistent application data.

The frontend will communicate with the backend through HTTP APIs.

We will initially develop the application locally using fictional financial data.

## Rationale

This architecture separates user-interface concerns from business logic and data persistence.

It provides opportunities to learn TypeScript, Java, relational databases, API design, and automated testing without introducing unnecessary infrastructure.

## Deferred Decisions

- WebSocket implementation
- AI service architecture
- Authentication and authorization
- Container deployment
- Production hosting

These will be evaluated when the application requires them.

## Consequences

The project will require maintaining separate frontend and backend applications.

However, each component will have a clear responsibility, making the system easier to understand, test, and extend.