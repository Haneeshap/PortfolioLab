.PHONY: all test unit integration contract coverage clean

all: test

test: unit integration contract

unit:
	python -m pytest tests/unit -v

integration:
	python -m pytest tests/integration -v --requires-internet

contract:
	python -m pytest tests/contract -v

coverage:
	python -m pytest --cov=app --cov-report=html

clean:
	rm -rf htmlcov .coverage