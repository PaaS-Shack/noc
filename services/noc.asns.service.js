

const C = require("../constants");

const DbService = require("db-mixin");

const ConfigLoader = require("config-mixin");

const whoiser = require('whoiser');

const { MoleculerClientError } = require("moleculer").Errors;


/**
 * Addons service
 */
module.exports = {
	name: "noc.asns",
	version: 1,

	mixins: [
		DbService({
			entityChangedEventMode: 'emit'
		}),
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
		rest: "/v1/noc/asns",


		indexes: {
			fields: {
				name: "text",
				description: "text"
			}
		},
		fields: {
			id: {
				type: "string",
				primaryKey: true,
				secure: true,
				columnName: "_id"
			},
			asn: {
				type: "number",
				required: true
			},
			name: {
				type: "string",
				required: true,
				trim: true,
			},
			description: {
				type: "string",
				required: false,
				trim: true,
			},
			created: {
				type: "number",
				//set: ({ params }) => new Date(params.RegDate),
				required: true
			},
			updated: {
				type: "number",
				//set: ({ params }) => new Date(params.Updated),
				required: true
			},


			options: { type: "object" },
			...C.TIMESTAMP_FIELDS
		},
		defaultPopulates: [],

		scopes: {
			notDeleted: { deletedAt: null },
		},

		defaultScopes: [ "notDeleted"]
	},

	/**
	 * Actions
	 */
	actions: {
		create: {
			permissions: ['vpns.create'],
			params: {

			}
		},
		list: {
			permissions: ['vpns.list'],
			params: {

			}
		},
		find: {
			rest: "GET /find",
			permissions: ['vpns.find'],
			params: {

			}
		},
		count: {
			rest: "GET /count",
			permissions: ['vpns.count'],
			params: {

			}
		},
		get: {
			needEntity: true,
			permissions: ['vpns.get'],
			params: {

			}
		},
		update: {
			needEntity: true,
			permissions: ['vpns.update'],
			params: {

			}
		},
		replace: false,
		remove: {
			needEntity: true,
			permissions: ['vpns.remove'],
			params: {

			}
		},

		lookup: {
			params: {
				asn: { type: "number", optional: false },
				create: { type: "boolean", default: true, optional: true },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				let entity = await this.findEntity(ctx, { query: { asn: params.asn } })
				if (params.create && !entity) {
					const res = await this.lookup(ctx, params.asn)

					entity = await this.createEntity(ctx, {
						...res
					})
					this.logger.info(`New ASN found AS${entity.asn} ${entity.name} ${entity.id}`);
				}
				return entity
			}
		},

		range: {
			params: {
				ip: { type: "string", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				const int = this.ip2int(params.ip)
				return this.findEntities(null, {
					query: {
						$and: [
							{ "rangeHigh": { $gte: int } },
							{ "rangeLow": { $lte: int } }]
					}
				}, { raw: true })

			}
		},

	},

	/**
	 * Events
	 */
	events: {


		async "routes.created"(ctx) {
			const route = ctx.params.data;

		},

	},

	/**
	 * Methods
	 */
	methods: {
		async lookup(ctx, asn) {

			const entity = {
				asn,
				source: 'iana'
			}

			let res = await whoiser.asn(asn, {
				//host:'riswhois.ripe.net'
			})
			let keys = Object.keys(res)

			if (keys.length < 3) {
				entity.source = 'ripe'
				res = await whoiser.asn(asn, {
					host: 'riswhois.ripe.net'
				})
				keys = Object.keys(res)
				if (keys.length == 1) {
					return {}
				}
				entity.name = res.descr
				entity.description = ''
				entity.created = res['lastupd-frst'] && res['lastupd-frst'].split(' ').shift();
				entity.updated = res['lastupd-last'] && res['lastupd-last'].split(' ').shift()
				entity.created = new Date(entity.created)
				entity.updated = new Date(entity.updated)
			} else {

				entity.name = res.ASName
				entity.description = res.organisation.OrgName
				entity.created = res.RegDate
				entity.updated = res.Updated
				entity.created = new Date(entity.created)
				entity.updated = new Date(entity.updated)
			}
			return entity
		},
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
		},
		ip2int(ip) {
			return ip.split('.').reduce(function (ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10) }, 0) >>> 0;
		},
		int2ip(ipInt) {
			return ((ipInt >>> 24) + '.' + (ipInt >> 16 & 255) + '.' + (ipInt >> 8 & 255) + '.' + (ipInt & 255));
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

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() { }
};