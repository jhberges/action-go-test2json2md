import * as core from '@actions/core'
import * as toolCache from '@actions/tool-cache'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as util from 'util'
// Borrowing from https://github.com/autero1/action-gotestsum
const executableName = 'go-test2json2md'
const fullExecutableFormat = 'go-test2json2md_%s_amd64'
const downloadUrlFormat = `https://github.com/jhberges/go-test2json2md/releases/download/%s/${fullExecutableFormat}.tar.gz`

export function getExecutableExtension(): string {
  if (os.type().match(/^Win/)) {
    return '.exe'
  }
  return ''
}

export function getDownloadURL(version: string): string {
  switch (os.type()) {
    case 'Windows_NT':
      return util.format(
        downloadUrlFormat,
        version,
        'windows'
      )

    case 'Darwin':
      return util.format(
        downloadUrlFormat,
        version,
        'darwin'
      )

    case 'Linux':
    default:
      return util.format(
        downloadUrlFormat,
        version,
        'linux'
      )
  }
}

export function walkSync(
  dir: string,
  filelist: string[],
  fileToFind: string
): string[] {
  const files = fs.readdirSync(dir)
  filelist = filelist || []
  for (const file of files) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist, fileToFind)
    } else {
      core.debug(file)
      if (file === fileToFind) {
        filelist.push(path.join(dir, file))
      }
    }
  }
  return filelist
}

export function findExecutable(rootFolder: string): string {
  fs.chmodSync(rootFolder, '777')
  const filelist: string[] = []
  walkSync(rootFolder, filelist, executableName + getExecutableExtension())
  if (!filelist) {
    throw new Error(
      util.format('Gotestsum executable not found in path ', rootFolder)
    )
  } else {
    return filelist[0]
  }
}
export async function downloadBinary(version: string): Promise<string> {
  core.info(`[INFO] Setting up gotest2json2md version: '${version}'`)
  // See if we already have it installed
  let cachedToolpath = toolCache.find(executableName, version)
  if (!cachedToolpath) {
    let dlPath: string
    const dlURL = getDownloadURL(version)
    core.info(`[INFO] Downloading from: '${dlURL}'`)
    try {
      dlPath = await toolCache.downloadTool(dlURL)
    } catch (exception) {
      throw new Error(util.format('Failed to download gotest2json2md from ', dlURL))
    }

    // Changing temp path permissions
    fs.chmodSync(dlPath, '777')

    // Unzip the tool
    const unzippedPath = await toolCache.extractTar(dlPath)
    core.info(`[INFO] Unzipped to: '${unzippedPath}'`)

    const absExecutable = `${unzippedPath}${
      path.sep
    }${executableName}${getExecutableExtension()}`
    core.info(`[INFO] Absolute path to executable: '${absExecutable}'`)

    // Cache the tool
    cachedToolpath = await toolCache.cacheFile(
      absExecutable,
      executableName + getExecutableExtension(),
      executableName,
      version
    )
  }

  const executablePath = findExecutable(cachedToolpath)
  if (!executablePath) {
    throw new Error(
      util.format('Gotestsum executable not found in path ', cachedToolpath)
    )
  }

  fs.chmodSync(executablePath, '777')
  return executablePath
}

async function run(): Promise<void> {
  try {
    const toolVersion: string = core.getInput('gotest2json2md_version')
    const cachedPath = await downloadBinary(toolVersion)

    // Add the cached tool to path
    core.addPath(path.dirname(cachedPath))
    core.info(
      `[INFO] Gotestsum version: '${toolVersion}' has been cached at ${cachedPath}`
    )
    core.setOutput('gotest2json2md_path', cachedPath)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
