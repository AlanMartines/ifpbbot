/* eslint-disable camelcase */
const { Context } = require('telegraf')
const log = require('@logger')
const { optionsList } = require('@helpers/parse-messages-helpers')

/**
 * Converte uma resposta para o formato da biblioteca telegraf
 * @param {object} msg - Mensagem de resposta do Dialogflow
 * @param {Context} ctx - Contexto da biblioteca
 */
async function parseResponse(msg, ctx, i, responses) {
	const isGroup = ctx.chat.type.includes('group')
	const forceReply = isGroup ? { force_reply: true, input_field_placeholder: 'Responda ao ChatBot', selective: true } : {}
	const inlineKeyboard = msg.buttons ? {
		inline_keyboard: msg.buttons.map((opt) => [{
			text: opt.text, callback_data: opt.text
		}])
	} : {}
	const replyToMessageID = isGroup ? { reply_to_message_id: ctx.message?.message_id } : {}
	const replyMarkup = { reply_markup: { ...forceReply, ...inlineKeyboard }, ...replyToMessageID }

	// Coloque os tipos de mensagem abaixo
	const MESSAGE_TYPES = {
		/** Texto */
		async text() {
			if (msg.text) await ctx.replyWithMarkdown(msg.text, replyMarkup)
		},

		/** Imagem */
		async image() {
			await ctx.replyWithPhoto(msg.rawUrl, { caption: msg.caption || msg.accessibilityText, ...replyMarkup })
		},

		/** Arquivo */
		async file() {
			await ctx.replyWithDocument(msg.url, replyMarkup)
		},

		/** Contato */
		async contact() {
			await ctx.replyWithContact(msg.phone, msg.name, replyMarkup)
		},

		/** Acordeão */
		async accordion() {
			await ctx.replyWithMarkdown(`*${msg.title}*\n────────────────────\n${msg.text}`, replyMarkup)
		},

		/** Lista de opções */
		async option_list() {
			await ctx.replyWithMarkdown(optionsList(msg), replyMarkup)
		},

		/** Figurinha */
		async sticker() {
			await ctx.replyWithSticker(msg.url)
		}
	}

	await MESSAGE_TYPES[msg.type.toLowerCase().trim()]?.()
}

/**
 * Retorna as respostas formatadas para a biblioteca telegraf
 * 
 * @param {object[]} responses - Respostas do Dialogflow
 * @param {Context} ctx - Contexto da biblioteca 
 */
async function parseMessages(responses, ctx) {
	try {
		for (const i in responses) {
			const msg = responses[i]
			if (!msg) continue

			// Remove as respostas com o parâmetro "ignoreWhatsApp"
			if (msg.ignoreTelegram || msg.ignoretelegram) {
				responses[i] = null
				continue
			}

			// Converte links de Chips para texto
			if (msg.type === 'chips' && msg.options.some(o => o.link)) {
				responses[i] = msg.options.map(o => ({
					type: 'text',
					text: `*${o.text}*\n${o.link || ''}`
				}))
			}

			// Une respostas com Chips e a anterior
			if (msg.type === 'chips' && i - 1 >= 0) {
				let index = i
				while (!responses[index - 1] && index >= 0) index--

				if (!responses[index - 1]) continue

				if (!responses[index - 1].buttons) responses[index - 1].buttons = msg.options
				else responses[index - 1].buttons.push(...msg.options)

				responses[i] = null
			}
		}

		// Printa as respostas no ambiente de desenvolvimento
		log('cyan', 'Telegram', true)(responses)

		// Converte as respostas para o formato da biblioteca Telegraf
		responses = responses.flat().filter(msg => msg)
		for (const [i, response] of Object.entries(responses)) {
			await parseResponse(response, ctx, i, responses).catch((err) => {
				// Erro ao enviar mensagem
				log('redBright', 'Telegram')('Erro ao analisar mensagem:', err, response)
				ctx.replyWithMarkdown('🐛 _Ocorreu um erro ao enviar esta mensagem_')
			})
		}
	} catch (err) {
		// Erro ao analisar mensagens
		log('redBright', 'Telegram')('Erro ao analisar mensagens:', err, responses)
		ctx.replyWithMarkdown('🐛 _Desculpe! Ocorreu um erro ao analisar as mensagens_')
	}
}

module.exports = parseMessages