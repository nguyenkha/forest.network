# forest.network - decentralized social network

## Requirements

- Install Docker CE: [https://docs.docker.com/install/](https://docs.docker.com/install/)

## Mainnet

1. Init tendermint

```bash
docker-compose run --rm tendermint init
```

2. Run node

```bash
docker-compose up --build
```

## Testnet

1. Run node

```bash
docker-compose -f docker-compose.testnet.yaml up --build
```
