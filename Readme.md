# Hermaphrodite

### Présentation

    Hermaphrodite est un bot discord développé dans le but de remplir 
    certaine fonctionnalités
    
### Installation
    Vous devez avoir docker d'installer sur votre machine
    Pour installer et démarrer le bot :
##### Installer les dépendances :
           - Si vous avez node installé sur votre machine : 
                cd bot && npm install
           - Sinon ($PWD si vous êtes sur linux et %cd% si vous êtes sur Windows) : 
                docker run -ti --rm -v "[$PWD ou %cd%]/bot:/bot" -w="/bot" node:14 npm install
#####Fichiers de confituration :
           - Copiez .env.example dans .env
           - Copier bot/config.example.js dans bot/config.js
           - Vous pouvez modifier les informations de connexion dans les
             deux fichiers, tout en faisant en sorte que ça corresponde
#####Lancer le projet :
           - Lancer : docker-compose up
           - Ou bien : docker-compose -d pour le lancer en tache de fond
#####Pour le relancer et voir les logs:
           - Pour le relancer : docker-compose restart node
           - Pour voir les logs : docker-compose logs -f node
           - Pour pouvez également faire des alias si vous êtes 
             sur linux pour faire des commandes plus courtes
             