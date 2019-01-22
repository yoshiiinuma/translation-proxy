
import http from 'http';
import https from 'https';

const AgentSelector = {};

AgentSelector.select = (req) => {
  return (req.connection.encrypted) ? https : http;
}

export default AgentSelector;
