# Overview

This is a backend designed to interact with the canvas API, and get a set of JSON objects containing a users grades, rather than doing many canvas API calls in the frontend. This simply exists to make canvas grades easier to access.

[Get all of your canvas grades at once!](https://youtu.be/PMaFMreImT4)

# Env Configuration
PORT=%%%
CANVAS_TOKEN=%%%

# Development Environment

Programmed using NodeJS v16.15.1

Utilizing ExpressJS v4.18.2

Utilizing Axios v1.3.3

Utilizing DotEnv v16.0.3

Utilizing Cors v2.8.5

# Useful Websites

- [Canvas Dev & Friends](https://instructure.github.io/)
- [Canvas API Documentation](https://canvas.instructure.com/doc/api/all_resources.html)

# Future Work

Before I can work on the OAuth elements of this project, I will need to contact my universities Canvas admin, or create my own personal Canvas account (so that I can be the admin of it) in order to continue development.

- Implement Oauth Token Grant
- Implement Refresh Tokens