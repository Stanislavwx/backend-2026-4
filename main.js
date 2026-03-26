const http = require("http");
const path = require("path");
const { access, readFile, writeFile } = require("fs/promises");
const { Command } = require("commander");
const { XMLBuilder } = require("fast-xml-parser");

const program = new Command();

program
  .helpOption(false)
  .requiredOption("-i, --input <path>", "path to input file")
  .requiredOption("-h, --host <host>", "server host")
  .requiredOption("-p, --port <port>", "server port");

program.parse(process.argv);

const options = program.opts();
const inputPath = path.resolve(options.input);
const outputPath = path.resolve("output.xml");
const host = options.host;
const port = Number(options.port);

if (Number.isNaN(port)) {
  console.error("Port must be a number");
  process.exit(1);
}

const xmlBuilder = new XMLBuilder({
  format: true,
  suppressEmptyNode: false
});

function parseInputFile(text) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return [];
  }

  if (trimmedText.startsWith("[")) {
    return JSON.parse(trimmedText);
  }

  return trimmedText
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

function isSurvived(value) {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    return normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "yes";
  }

  return false;
}

function buildPassenger(passenger, showAge) {
  const xmlPassenger = {
    name: passenger.Name ?? "",
    ticket: passenger.Ticket ?? ""
  };

  if (showAge) {
    xmlPassenger.age = passenger.Age ?? "";

    return {
      name: xmlPassenger.name,
      age: xmlPassenger.age,
      ticket: xmlPassenger.ticket
    };
  }

  return xmlPassenger;
}

async function buildXml(searchParams) {
  const fileContent = await readFile(inputPath, "utf8");
  const passengers = parseInputFile(fileContent);
  const onlySurvived = searchParams.get("survived") === "true";
  const showAge = searchParams.get("age") === "true";

  const filteredPassengers = onlySurvived
    ? passengers.filter((passenger) => isSurvived(passenger.Survived))
    : passengers;

  const xmlData = {
    passengers: {
      passenger: filteredPassengers.map((passenger) => buildPassenger(passenger, showAge))
    }
  };

  return xmlBuilder.build(xmlData);
}

async function startServer() {
  try {
    await access(inputPath);
  } catch (error) {
    console.error("Cannot find input file");
    process.exit(1);
  }

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://${host}:${port}`);
      const xml = await buildXml(requestUrl.searchParams);

      await writeFile(outputPath, xml, "utf8");

      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(xml);
    } catch (error) {
      if (error.code === "ENOENT") {
        console.error("Cannot find input file");
        response.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8"
        });
        response.end("Cannot find input file");
        return;
      }

      console.error(error.message);
      response.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("Internal server error");
    }
  });

  server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
  });
}

startServer();
