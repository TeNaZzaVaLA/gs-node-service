import { glob } from "glob";
import path from "path";

import { logger } from "../logger";
import { PlainObject } from "../types";
import expandVariables from './expandVariables';
import loadYaml from "./yamlLoader";
import { DataSource } from "./_interfaces/sources";


// we need to scan only the first level of datasources folder
export default async function (pathString: string): Promise<{ [key: string]: DataSource }> {
  let yamlDatasources = await loadYaml(pathString, false);

  const prismaDatasources = await loadPrismaDsFileNames(pathString);
  const datasourcesConfigs = { ...yamlDatasources, ...prismaDatasources };

  const datasources: { [key: string]: DataSource } = {};

  for await (let dsName of Object.keys(datasourcesConfigs)) {
    logger.debug('evaluating datasource %s', dsName);
    datasourcesConfigs[dsName] = expandVariables(datasourcesConfigs[dsName]);
    logger.debug('evaluated datasource %s %o', dsName, datasourcesConfigs[dsName]);

    // let's load the loadFn and executeFn
    // there is an assumption that for each datasource, the type's .ts file should be inside /datasources/types folder
    const fileName = datasourcesConfigs[dsName].type;


    await import(path.join(pathString, 'types', `${fileName}`))
      .then(async (Module: DataSource) => {
        const dsYamlConfig: PlainObject = datasourcesConfigs[dsName];
        // @ts-ignore
        const dsInstance = new Module.default(dsYamlConfig); // eslint-disable-line

        await dsInstance.init(); // This should initialize and set the client in dsInstance
        if (!dsInstance.client) {
          throw new Error(`Client could not be initialized in your datasource ${dsName}`);
        }
        datasources[dsName] = dsInstance;
      });
  }

  return datasources;
}

async function loadPrismaDsFileNames(pathString: string): Promise<PlainObject> {
  let basePath = path.basename(pathString);
  let prismaSchemas: PlainObject = {};

  const files = glob.sync(pathString + '/**/*.?(prisma)');

  files.forEach((file: string) => {
    if (file.includes('generated-client')) {
      return;
    }
    const id = file
      .replace(new RegExp(`.*?\/${basePath}\/`), '')
      .replace(/\//g, '.')
      .replace(/\.(prisma)/i, '')
      .replace(/\.index$/, '');
    prismaSchemas = {
      ...prismaSchemas,
      ...{
        [id]: {
          type: 'datastore',
        },
      },
    };
  });

  return prismaSchemas;
}