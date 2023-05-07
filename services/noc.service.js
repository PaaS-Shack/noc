
const C = require("../constants");
const ConfigLoader = require("config-mixin");
const whoiser = require('whoiser');

const { MoleculerClientError } = require("moleculer").Errors;
const Lock = require('../lib/lock')


/**
 * Addons service
 */
module.exports = {
	name: "noc",
	version: 1,

	mixins: [
		ConfigLoader(['noc.**']),
	],

	/**
	 * Service dependencies
	 */
	dependencies: [],

	/**
	 * Service settings
	 */
	settings: {
		rest: "/v1/noc",


	},

	/**
	 * Actions
	 */
	actions: {





		domain: {
			params: {
				domain: { type: "string", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				return whoiser.domain(params.domain, { follow: 2 })
			}
		},
		ip: {
			params: {
				ip: { type: "string", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				const res = await whoiser.ip(params.ip, {})
				console.log('ip', res)
				const rangeHigh = res.range.split(' - ')[1]
				const rangeLow = res.range.split(' - ')[0]

				const asnNumbers = res.asn.split(',').map((s) => s.trim())

				const asns = []

				for (let index = 0; index < asnNumbers.length; index++) {
					const asnNumber = Number(asnNumbers[index].replace('AS', ''));
					asns.push(ctx.call('v1.noc.asns.lookup', {
						asn: asnNumber
					}))
				}

				const network = await ctx.call('v1.noc.networks.lookup', {})







				return Promise.allSettled(result)

			}
		},
		asn: {
			params: {
				asn: { type: "number", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);




				return whoiser.asn(params.asn, {})
			}
		},

	},

	/**
	 * Events
	 */
	events: {


		async "noc.smtp"(ctx) {
			const params = ctx.params;
			const node = await ctx.call('v1.nodes.resolveNode', {
				node: ctx.nodeID
			})
			console.log("noc.smtp", params, node)
		},
		async "noc.http"(ctx) {
			const params = ctx.params;
			const start = Date.now()


			if (!this.vHosts.has(params.meta.vHost)) {
				await this.lock.acquire(params.meta.vHost)
				const route = await ctx.call('v1.routes.resolveRoute', {
					vHost: params.meta.vHost
				})
				this.vHosts.set(params.meta.vHost, {
					score: route ? 0 : -1,
					route: route,
					vHost: params.meta.vHost
				})

				await this.lock.release(params.meta.vHost)

			}


			const vHost = this.vHosts.get(params.meta.vHost)

			let host = await ctx.call('v1.noc.hosts.lookup', {
				ip: params.ip
			})
			if (vHost.score < 0 && host) {
				host = await ctx.call('v1.noc.hosts.score', {
					id: host.id,
					score: vHost.score
				})
				if (host.score < 0 && host.score > -10) {


					this.logger.info(`Incident report: HTTP ${host.ip} -> ${params.meta.vHost}${params.meta.url}`);
					console.log('v1.noc.incidents.create', {
						host: host.id,
						meta: params.meta,
						source: 'http'
					})
				}
			}
		},

	},

	/**
	 * Methods
	 */
	methods: {
		async validateHasNode(query, ctx, params) {
			// Adapter init
			if (!ctx) return query;

			if (params.node) {
				const res = await ctx.call("v1.nodes.resolve", {
					id: params.node
				});

				if (res) {
					query.node = params.node;
					return query;
				}
				throw new MoleculerClientError(
					`You have no right for the node '${params.node}'`,
					403,
					"ERR_NO_PERMISSION",
					{ node: params.node }
				);
			}
			if (ctx.action && ctx.action.params.node && !ctx.action.params.node.optional) {
				throw new MoleculerClientError(`node is required`, 422, "VALIDATION_ERROR", [
					{ type: "required", field: "node" }
				]);
			}
		},
		exec(ctx, cmd, nodeID) {
			return ctx.call('v1.node.cmd', {
				cmd
			}, { nodeID }).then((res) => {

				if (res.stdout.length) {
					return res.stdout
				}
				return res.stderr
			})
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() { },

	/**
	 * Service started lifecycle event handler
	 */
	started() {

		this.vHosts = new Map()
		this.ips = new Map()

		this.lock = new Lock()
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() { }
};