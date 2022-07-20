require('dotenv/config')
require('module-alias/register')
const chalk = require('chalk')
const log = require('@logger')
const makeBox = require('@helpers/makebox')
const printLogo = require('@helpers/print-logo')
const { isDisabled } = require('@helpers')
process.on('uncaughtException', log('redBright', 'Erro não capturado'))
const MODULES = require('./modules')
let error = false

// Limpa a tela e imprime o logo
console.clear()
console.log(makeBox('           IFPB ChatBot           ', chalk.yellowBright, chalk.yellow))
printLogo()

// Módulo de status do servidor
try {
	require('@modules/status')
} catch (err) {
	log('redBright', 'Erro')('Erro ao executar o módulo de status do servidor', err)
}

// Checa possíveis erros
try {
	const CREDENTIALS = '{
	  "type": process.env.TYPE,
	  "project_id": process.env.PROJECT_ID,
	  "private_key_id": process.env.PRIVATE_KEY_ID,
	  "private_key": process.env.PRIVATE_KEY,
	  "client_email": process.env.CLIENT_EMAIL,
	  "client_id": process.env.CLIENT_ID,
	  "auth_uri": process.env.AUTH_URI,
	  "token_uri": process.env.TOKEN_URI,
	  "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
	  "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL
	}';
	JSON.parse(CREDENTIALS)
} catch {
	error = true
	log('redBright', 'Erro')('Credenciais do Dialogflow faltando')
	log('magentaBright', 'Erro')('Inclua suas credenciais do Dialogflow na variável de ambiente GCLOUD_CREDENTIALS')
}

if (!process.env.PROJECT_ID) {
	error = true
	log('redBright', 'Erro')('Nome do projeto do Dialogflow faltando')
	log('magentaBright', 'Erro')('Inclua o nome do projeto do Dialogflow na variável de ambiente PROJECT_ID')
}

// Fecha o processo se houver algum erro
if (error) process.exit()

// Inicia os módulos
MODULES.forEach(start)

// Inicia um módulo
function start(mod) {
	const { path, disabled, disabledMessage, started, error } = mod
	if (disabled) return log('cyan', 'Aviso')(disabledMessage)
	try {
		require(`./modules/${path}`)
		mod.started = true
	} catch (err) {
		log('redBright', 'Erro')(`Erro ao executar o módulo ${path}`, err)
		mod.error = { message: err.message, stack: err.stack }
	}
}
