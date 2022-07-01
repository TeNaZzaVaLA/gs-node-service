import loadYaml from "../core/yamlLoader";
import { PlainObject } from '../core/common';
import { logger } from "../core/logger";
import * as fs from 'fs';
import { removeNulls } from "../core/utils";
const swaggerCommanPart: PlainObject = require('./basic-spec.json');

export default async function generateSchema(eventsFolderPath: string): Promise<PlainObject> {
  const eventsSchema: PlainObject = await loadEventsYaml(eventsFolderPath);
  const finalSpec = JSON.parse(JSON.stringify(swaggerCommanPart)); //Make a deep clone copy

  Object.keys(eventsSchema).forEach((event:any) => {
    let apiEndPoint = event.split('.')[0];
    apiEndPoint = apiEndPoint.replaceAll(/:([^\/]+)/g, "{$1}"); //We take :path_param. OAS3 takes {path_param}
    const method = event.split('.')[2];
    const eventSchema = eventsSchema[event];
      
    //Initialize the schema for this method, for given event
    let methodSpec: PlainObject = {
      summary: eventSchema.summary,
      description: eventSchema.description,
      requestBody: eventSchema.body || eventSchema.data?.schema?.body,
      parameters: eventSchema.params || eventSchema.data?.schema?.params,
      responses: eventSchema.responses,
    };

    //Set it in the overall schema
    finalSpec.paths[apiEndPoint] = {
      [method]: methodSpec
    };
  });
  removeNulls(finalSpec);
  // fs.writeFileSync('/tmp/t.json', JSON.stringify(finalSpec));
  return finalSpec;
}
async function loadEventsYaml(path:string){
  try {
    return await loadYaml(path, true);
  } catch(ex) {
    logger.error('Error in reading events YAMLs', ex);
    process.exit(1);
  }
}

if (require.main === module) {
  generateSchema('/home/kushal/mindgrep/gs_project_template/gs_service/dist/events')
  .then((schema) => {
    fs.writeFileSync('/tmp/t.json', JSON.stringify(schema));
    console.log('done');
  })
  .catch((e) => {
    console.log('Error', e);
  });
}