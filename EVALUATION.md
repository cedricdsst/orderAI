# OrderAI

## Membres du groupe
- Cédric DOUSSET

## Pipeline CI/CD

Ce projet utilise GitHub Actions pour l'intégration continue (CI) et le déploiement continu (CD).

### Intégration Continue (CI)

Le CI se déclenche sur chaque Pull Request vers la branche `main`.

Pour tester localement avant de soumettre une PR :
```bash
# Installer les dépendances
pip install -r requirements.txt

# Lancer l'application
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

### Déploiement Continu

Le déploiement se fait automatiquement lors d'un push sur la branche `main`. Une image Docker est construite et publiée sur GitHub Container Registry.

Pour utiliser l'image Docker :
```bash
# Récupérer la dernière version
docker pull ghcr.io/cedricdsst/orderai:latest

# Lancer le conteneur
docker run -p 8000:8000 -e OPENAI_API_KEY=your_key ghcr.io/cedricdsst/orderai:latest
```

### Releases

Les releases sont créées automatiquement lors de la création d'un tag git commençant par 'v'.

Pour créer une nouvelle release :
```bash
git tag -a v1.0.0 -m "Description de la release"
git push origin v1.0.0
```

Cela déclenchera :
1. La création d'une release GitHub
2. La publication d'une image Docker taguée avec la version

