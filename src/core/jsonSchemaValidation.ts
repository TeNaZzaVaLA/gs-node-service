
import * as _ from "lodash";
import { GSCloudEvent , GSActor , GSStatus } from "../core/interfaces";
import Ajv from "ajv"
import addFormats from "ajv-formats";

import { PlainObject } from "./common";

const ajv = new Ajv()

export function loadJsonSchemaForEvents(eventObj: PlainObject) {
    console.log("eventObj: ", eventObj)
    // Add formats to ajv instance
    addFormats(ajv);

    Object.keys(eventObj).forEach(function(topic) {
        // Add body schema in ajv for each content_type per topic
        /* TODO: Right now, we are assuming that there is going to be one content_type only i.e. application/json
                This needs to be enhanced in fututre when multiple content_type will be supported
        */
       const eventObjTopic = eventObj[topic]
       console.log("topic1: ", topic)
       console.log("eventObjTopic: ", eventObjTopic)

       //Object.keys(eventObjTopic).forEach(function(topic) {
           console.log("topic: ",topic)
            const body_content= eventObjTopic?.data?.schema?.body?.content;
            if (body_content) {

                Object.keys(body_content).forEach(function(k) {
                    const content_schema = body_content[k].schema;
                    if(content_schema) {
                        console.log('adding body schema', topic, content_schema);
                        ajv.addSchema(content_schema, topic)
                    }
                });
            }

            // Add params schema in ajv for each param per topic
            const params = eventObjTopic?.data?.schema?.params;
            let paramSchema:PlainObject = {}

            if (params) {
                for (let param of params) {
                    if(param.schema) {
                        if (!paramSchema[param.in]) {
                            paramSchema[param.in] = {
                                type: 'object',
                                required: [],
                                properties: {}
                            }
                        }

                        if (param.required) {
                            paramSchema[param.in].required.push(param.name)
                        }

                        let schema = param.schema;
                        if (param.allow_empty_value) {
                            param.schema.nullable = true;
                        }

                        paramSchema[param.in].properties[param.name] = schema;
                    }
                }
            }

            for (let schema in paramSchema) {
                console.log('adding param schema', schema, paramSchema[schema],);
                const topic_param = topic + ':'+ schema;
                ajv.addSchema( paramSchema[schema], topic_param)
            }

            // Add responses schema in ajv for each response per topic
            const responses = eventObjTopic?.responses;
            if (responses) {
                Object.keys(responses).forEach(function(k) {
                    const response_s = responses[k]?.schema?.data?.content?.['application/json']?.schema;
                    if (response_s) {
                        const response_schema = response_s
                        const topic_response = topic + ':responses:'+ k
                        //console.log("topic_response: ",topic_response)
                        ajv.addSchema(response_schema, topic_response)
                    }
                });
            }
       });
    //});
}

/* Function to validate GSCloudEvent */
export function validateRequestSchema(topic: string, event: any, eventSpec: PlainObject): PlainObject{
    let status:PlainObject= {};


    // Validate event.data['body']
    if(event.data['body'])
    {
        //console.log("ajvschemas: ",ajv.schemas[topic])
        console.log("event.data['body']: ", event.data['body'], " topic: ", topic)
        const ajv_validate = ajv.getSchema(topic)
        if(ajv_validate !== undefined)
        {
            console.log("ajv_validate: ", ajv_validate)
            if (! ajv_validate(event.data['body'])) {
                console.log("! ajv_validate: ")
                status.success = false
                status.error = ajv_validate.errors
                return status
            }
            else{
                console.log("ajv validated")
                status.success = true
            }
        }
        else{
            status.success = true
        }
    }
    else {
        status.success = false
        status.error = "Body not present"
    }

    const params = eventSpec?.data?.schema?.params;

    // Validate event.data['params']
    let MAP:PlainObject = {
        'path': 'params',
        'header': 'headers',
        'query': 'query',
        'cookie': 'cookie',
    };

    if(params) {
        for (let param in MAP) {

            const topic_param = topic + ':'+ param;
            const ajv_validate = ajv.getSchema(topic_param)

            console.log('validating the schema for', topic_param, ajv_validate);
            if(ajv_validate)
            {
                if (!ajv_validate(event.data[MAP[param]])) {
                    status.success = false
                    status.code = 400
                    ajv_validate.errors![0].message += ' in ' + param;
                    status.message = ajv_validate.errors![0].message;
                    status.data = ajv_validate.errors![0];
                    return status
                }
                else {
                    status.success = true
                    return status
                }
            }
        }
    }
    return status
}

/* Function to validate GSStatus */
export function validateResponseSchema(topic: string, gs_status: GSStatus): PlainObject{
    let status:PlainObject= {};
    //console.log("gs_status: ",gs_status)

    if(gs_status.data)
    {
        const topic_response = topic + ':responses:' + gs_status.code
        const ajv_validate = ajv.getSchema(topic_response)
        if(ajv_validate !== undefined)
        {
            //console.log("ajv_validate: ",ajv_validate)
            if (! ajv_validate(gs_status.data)) {
                console.log("! ajv_validate: ")
                status.success = false
                status.error = ajv_validate.errors
            }
            else{
                console.log("ajv validated")
                status.success = true
            }
        }
        else{
            status.success = true
        }
    }
    else {
        status.success = false
        status.error = "Response data is not present"
    }
    return status
}