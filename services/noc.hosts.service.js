"use strict";

const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * network operations center host service
 */

module.exports = {
	// name of service
	name: "noc.hosts",
	// version of service
	version: 1,

	/**
	 * Service Mixins
	 * 
	 * @type {Array}
	 * @property {DbService} DbService - Database mixin
	 * @property {ConfigLoader} ConfigLoader - Config loader mixin
	 */
	mixins: [
		DbService({
			permissions: 'noc.hosts'
		}),
		ConfigLoader(['noc.**']),
	],

	/**
	 * Service dependencies
	 */
	dependencies: [

	],

	/**
	 * Service settings
	 * 
	 * @type {Object}
	 */
	settings: {
		rest: true,

		fields: {
			network: {
				type: "string",
				empty: false,
				populate: {
					action: "v1.noc.networks.resolve"
				}
			},
			ip: {
				type: "string",
				required: true
			},
			hostname: {
				type: "string",
				required: false
			},

			ipInt: {
				type: "number",
				set: function ({ params }) {
					return this.ip2int(params.ip)
				},
				required: false
			},

			hits: {
				type: "number",
				default: 0,
				required: false
			},
			score: {
				type: "number",
				default: 0,
				required: false
			},

			...DbService.FIELDS,// inject dbservice fields
		},

		// default database populates
		defaultPopulates: [],

		// database scopes
		scopes: {
			...DbService.SCOPE,// inject dbservice scope
		},

		// default database scope
		defaultScopes: [...DbService.DSCOPE],// inject dbservice dscope

		// default init config settings
		config: {

		}
	},

	/**
	 * service actions
	 */
	actions: {
		/**
		 * resolve host from ip
		 * 
		 * @actions
		 * 
		 * @param {string} ip
		 * 
		 * @returns {Object} host object
		 */
		lookup: {
			params: {
				ip: {
					type: "string",
					required: true
				}
			},
			async handler(ctx) {
				const { ip } = ctx.params;
				let host = await this.findEntity(null, {
					query: {
						ip: ip
					}
				});

				return host;
			}
		},
	},

	/**
	 * service events
	 */
	events: {

	},

	/**
	 * service methods
	 */
	methods: {
		/**
		 * ip to int
		 * 
		 * @param {string} ip
		 * 
		 * @returns {number} ip as int
		 */
		ip2int(ip) {
			return ip.split('.').reduce(function (ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10) }, 0) >>> 0;
		},

		/**
		 * int to ip
		 * 
		 * @param {number} ipInt
		 * 
		 * @returns {string} ip as string
		 */
		int2ip(ipInt) {
			return ((ipInt >>> 24) + '.' + (ipInt >> 16 & 255) + '.' + (ipInt >> 8 & 255) + '.' + (ipInt & 255));
		}
	}

}



