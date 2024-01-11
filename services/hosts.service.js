const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const whoiser = require('whoiser');


/**
 * Network Operation Center - Hosts
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

            // ip address
            ip: {
                type: "string",
                required: true,
            },

            // hostname
            hostname: {
                type: "string",
                required: false
            },

            // ASN 
            asn: {
                type: "string",
                required: false,
                populate:{
                    action:"v1.noc.asns.get",
                }
            },

            // network
            network: {
                type: "string",
                required: false,
                populate:{
                    action:"v1.noc.networks.get",
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

