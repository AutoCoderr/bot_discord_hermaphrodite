# Hermaphrodite

### Présentation

Hermaphrodite est un bot discord développé dans le but de remplir
certaine fonctionnalités

### Installation
- Vous devez avoir docker d'installé sur votre machine
  
###Pour installer et démarrer le bot :
##### Installer les dépendances :
- Si vous avez node installé sur votre machine :
  cd bot && npm install
- Sinon ($PWD si vous êtes sur linux et %cd% si vous êtes sur Windows) :
  docker run -ti --rm -v "[$PWD ou %cd%]/bot:/bot" -w "/bot" node:14 npm install
##### Fichiers de confituration :
- Copiez .env.example dans .env
- Copiez bot/config.example.js dans bot/config.js
- Vous pouvez modifier les informations de connexion dans les
  deux fichiers, tout en faisant en sorte que ça corresponde
- Dans le config.js, je vous invite à mettre le token pour votre application
- Et à mettre un prefix, que ne soit pas le même que celui d'un autre bot sur le même serveur
##### Lancer/stopper le projet :
- Lancer : docker-compose up -d
- Stopper : docker-compose down
##### Pour le relancer et voir les logs:
- Pour le relancer : docker-compose restart bot
- Pour voir les logs : docker-compose logs -f bot
- Pour pouvez également faire des alias si vous êtes sur linux pour faire des commandes plus courtes
