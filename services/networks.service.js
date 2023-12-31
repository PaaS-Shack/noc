const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const whoiser = require('whoiser');


/**
 * Network Operation Center - Networks
 * Here we track diffrent network ranges that we interact with.
 * Services like SSH, HTTP, SMTP, FTP, etc. will use this to determine if a connection is allowed.
 */

module.exports = {
    // name of service
    name: "noc.networks",
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
        DbService({}),
        ConfigLoader([
            'noc.**'
        ]),
    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     * 
     * @type {Object}
     */
    settings: {
        rest: true,

        fields: {

            // network name
            name: {
                type: "string",
                required: true,
            },

            // network lower range
            lower: {
                type: "number",
                required: true,
            },

            // network upper range
            upper: {
                type: "number",
                required: true,
            },

            // network description
            description: {
                type: "string",
                required: false,
            },

            // network asns (autonomous system numbers)
            asns: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.noc.asns.get",
                }
            },

            // network discovered hosts
            hosts: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.noc.hosts.get",
                }
            },


            ...DbService.FIELDS,// inject dbservice fields
        },
        defaultPopulates: [],

        scopes: {
            ...DbService.SCOPE,
        },

        defaultScopes: [
            ...DbService.DSCOPE,
        ],

        // default init config settings
        config: {

        }
    },

    /**
     * service actions
     */
    actions: {

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
        
    },

    /**
     * service created lifecycle event handler
     */
    created() { },

    /**
     * service started lifecycle event handler
     */
    async started() { },

    /**
     * service stopped lifecycle event handler
     */
    async stopped() { },

}

