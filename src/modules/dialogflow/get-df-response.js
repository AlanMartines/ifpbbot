const path = require('path')
const { jsonParse, randomItem } = require('@helpers')
const log = require('@logger')
const dialogflow = require('@google-cloud/dialogflow')
const { value } = require('pb-util')
const setContexts = require('./set-df-contexts')
const LocalSessions = require('./LocalSessions')
const RemoteSessions = require('./RemoteSessions')
const runAction = require('./actions')
const sessions = process.env.MONGO_DB
	? new RemoteSessions()
	: new LocalSessions(path.resolve(__dirname, './df-sessions.json'))

// Checa possíveis erros
const CREDENTIAL = {
  "type": process.env.TYPE,
  "project_id": process.env.PROJECT_ID,
  "private_key_id": process.env.PRIVATE_KEY_ID,
  "private_key": process.env.PRIVATE_KEY.replace(/\n/gm, '\n'),
  "client_email": process.env.CLIENT_EMAIL,
  "client_id": process.env.CLIENT_ID,
  "auth_uri": process.env.AUTH_URI,
  "token_uri": process.env.TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL
};

const CREDENTIALS = jsonParse(CREDENTIAL)

/**
 * Faz uma requisição para o Dialogflow
 * @async
 * @param {string} text - Texto da mensagem recebida
 * @param {string} from - ID único do chat ou contato da mensagem recebida
 * @param {string} [platform=''] - Prefixo para o ID de sessão usado para diferenciar plataformas (exemplo: 'whatsapp')
 * @param {object} [info={}] - Mais informações para serem adicionadas na sessão
 * @returns {Promise<{ responses: object[] }>} Retorna as respostas do Dialogflow
 */
async function getDFResponse(text, from, platform = '', info = {}) {
	try {
		from = platform + from

		// Cria ou retoma as sessões remotas
		const sessionClient = new dialogflow.SessionsClient({
			credentials: CREDENTIALS
		})

		const sessionPath = sessionClient.projectAgentSessionPath(
			process.env.PROJECT_ID, from
		)

		// Cria uma nova sessão caso não exista
		if (!sessions.data[from]) sessions.data[from] = {
			firstInteraction: new Date(),
			lastInteraction: new Date(),
			messageCount: 0,
			platform,
			...info,
			contexts: []
		}

		// Se a última mensagem da pessoa foi há mais de 5 minutos, define os contextos no Dialogflow
		if (new Date() - sessions.data[from].lastInteraction > 300000) {
			await setContexts(sessions.data[from].contexts, sessionPath)
		}

		// Faz um request para o servidor do Dialogflow
		const request = {
			session: sessionPath,
			queryInput: {
				text: {
					text: text,
					languageCode: 'pt-BR'
				}
			}
		}

		const [response] = await sessionClient.detectIntent(request)
		await runAction(response, { from, platform, text })
		const contexts = response.queryResult.outputContexts

		// Atualiza as sessões
		sessions.data[from].contexts = contexts
		sessions.data[from].lastInteraction = new Date()
		sessions.data[from].messageCount++

		// Converte as respostas em formato de String e Payload em Objeto
		const responses = response.queryResult.fulfillmentMessages
			.map(parseResponse)
			.flat()
			.filter(filterInvalidResponses)
			.map(parseRandomResponses)
			.flat()
			.filter(filterInvalidResponses)

		// Retorna as respostas do Dialogflow
		return responses
	} catch (err) {
		// Erro ao analisar respostas do Dialogflow
		log('redBright', 'Dialogflow')('Erro ao analisar respostas:', err)
		return [{ type: 'text', text: '🐛 _Desculpe! Ocorreu um erro ao analisar as respostas da intenção, por favor contate o administrador_' }]
	}
}

// Converte as respostas do formato do Dialogflow para objetos comuns
function parseResponse(msg) {
	if (msg.text) return {
		type: 'text',
		text: msg.text.text.join('\n')
	}
	if (msg.payload) {
		return value.decode(msg.payload.fields.richContent)[0]
	}
}

// Se houver um payload do tipo 'random', seleciona uma escolha aleatória
function parseRandomResponses(msg) {
	if (msg.type.toLowerCase().trim() === 'random' && Array.isArray(msg.items)) {
		return randomItem(msg.items)
	}

	return msg
}

// Remove respostas inválidas
function filterInvalidResponses(msg) {
	if (typeof msg !== 'object') return false
	if (typeof msg.type !== 'string') return false
	return msg
}

module.exports = getDFResponse
