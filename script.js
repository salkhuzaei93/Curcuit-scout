const form = document.querySelector("#circuit-form");
const circuitInput = document.querySelector("#circuit-name");
const layerSelect = document.querySelector("#layer");
const mediaSelect = document.querySelector("#media");
const vendorSelect = document.querySelector("#vendor");
const routingLabel = document.querySelector("#routing-label");
const routingInput = document.querySelector("#routing");
const terminal = document.querySelector("#terminal");
const copyButton = document.querySelector("#copy");
const tags = {
  siteA: document.querySelector('[data-tag="siteA"]'),
  siteZ: document.querySelector('[data-tag="siteZ"]'),
  circuitId: document.querySelector('[data-tag="circuitId"]'),
};

const upeRow = document.querySelector("#upe-row");
const customerIpRow = document.querySelector("#customer-ip-row");
const gatewayRow = document.querySelector("#gateway-row");

const layerDetection = {
  layer3: ["IP", "SIP"],
  layer2: ["DIA", "PLL", "DLL"],
};

const routingLabels = {
  Cisco: "VRF Name",
  Huawei: "VPN Instance",
  Juniper: "Routing Instance",
};

const normalizeValue = (value) => value.trim();

const renderTags = ({ siteA, siteZ, circuitId }) => {
  tags.siteA.innerHTML = siteA ? `Site A: <strong>${siteA}</strong>` : "Site A";
  tags.siteZ.innerHTML = siteZ ? `Site Z: <strong>${siteZ}</strong>` : "Site Z";
  tags.circuitId.innerHTML = circuitId ? `Circuit ID: <strong>${circuitId}</strong>` : "Circuit ID";
};

const detectLayer = (circuitId) => {
  if (!circuitId) {
    return;
  }
  const upper = circuitId.toUpperCase();
  if (layerDetection.layer3.some((token) => upper.includes(token))) {
    layerSelect.value = "layer3";
  } else if (layerDetection.layer2.some((token) => upper.includes(token))) {
    layerSelect.value = "layer2";
  }
  toggleLayerFields();
};

const parseCircuit = (value) => {
  const trimmed = normalizeValue(value);
  if (!trimmed) {
    renderTags({ siteA: "", siteZ: "", circuitId: "" });
    return;
  }
  const tokens = trimmed.split(/\s+/);
  const siteToken = tokens.shift() || "";
  const circuitId = tokens.join(" ");
  const [siteA, siteZ] = siteToken.split("-");
  renderTags({ siteA: siteA || "", siteZ: siteZ || "", circuitId });
  detectLayer(circuitId);
};

const toggleMediaFields = () => {
  const media = mediaSelect.value;
  if (media === "UPE") {
    upeRow.classList.remove("hidden");
  } else {
    upeRow.classList.add("hidden");
  }
};

const toggleLayerFields = () => {
  const isLayer3 = layerSelect.value === "layer3";
  customerIpRow.classList.toggle("hidden", !isLayer3);
  gatewayRow.classList.toggle("hidden", !isLayer3);
};

const updateRoutingLabel = () => {
  const vendor = vendorSelect.value;
  routingLabel.textContent = routingLabels[vendor];
  routingInput.placeholder =
    vendor === "Cisco" ? "e.g., VRF-ACME" : vendor === "Huawei" ? "e.g., VPN-ACME" : "e.g., RI-ACME";
};

const buildCiscoL3 = (values) => {
  const safeInterface = values.interface || "<Interface>";
  const safeRouting = values.routing || "<VRF_Name>";
  const safeCustomerIp = values.customerIp || "<Customer_IP>";
  const safeCircuitId = values.circuitId || "<Circuit_ID>";
  return `! --- VERIFICATION CHEAT SHEET FOR ${safeCircuitId} ---
! 1. Check Interface Description & Status
sh int desc | i ${safeCircuitId}

! 2. Check Interface Configuration
sh run int ${safeInterface}

! 3. Verify Bridge Domain Status (if applicable)
sh l2vpn bridge-domain interface ${safeInterface} brief

! 4. Check L2VPN Bridge Group
sh run l2vpn bridge group ${safeRouting} bridge-domain ${values.vlan}

! 5. Verify L3 Interface (BVI) Configuration
sh run int BVI${values.vlan}

! 6. Check ARP Table for Customer Reachability
sh arp vrf ${safeRouting} ${safeCustomerIp}

! 7. Connectivity Test (Ping)
ping vrf ${safeRouting} ${safeCustomerIp} count 100

! 8. Check BGP Neighbors (if applicable)
show bgp vrf ${safeRouting} summary | i ${safeCustomerIp}`;
};

const collectValues = () => {
  const circuitName = normalizeValue(circuitInput.value);
  const tokens = circuitName.split(/\s+/);
  const siteToken = tokens.shift() || "";
  const circuitId = tokens.join(" ");

  return {
    circuitId,
    siteToken,
    orderType: form.orderType.value,
    layer: layerSelect.value,
    media: mediaSelect.value,
    vendor: vendorSelect.value,
    aggregator: normalizeValue(form.aggregator.value),
    upe: normalizeValue(form.upe.value),
    routing: normalizeValue(form.routing.value),
    vlan: normalizeValue(form.vlan.value),
    interface: normalizeValue(form.interface.value),
    customerIp: normalizeValue(form.customerIp.value),
    gateway: normalizeValue(form.gateway.value),
  };
};

const validate = (values) => {
  if (!values.circuitId) {
    return "Enter a circuit name with a circuit ID (e.g., JEDDAH-MAKKAH IP263).";
  }
  if (!values.vlan) {
    return "VLAN ID is required.";
  }
  if (values.layer === "layer3" && !values.customerIp) {
    return "Customer IP is required for Layer 3 circuits.";
  }
  return "";
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = collectValues();
  const error = validate(values);
  if (error) {
    terminal.textContent = `⚠️ ${error}`;
    copyButton.disabled = true;
    return;
  }

  if (values.vendor === "Cisco" && values.layer === "layer3") {
    terminal.textContent = buildCiscoL3(values);
  } else {
    terminal.textContent = "Command template not available for the selected vendor/layer yet.";
  }

  copyButton.disabled = false;
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(terminal.textContent);
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy to Clipboard";
    }, 1500);
  } catch (error) {
    terminal.textContent = `⚠️ Unable to copy: ${error.message}`;
  }
});

circuitInput.addEventListener("input", (event) => {
  parseCircuit(event.target.value);
});

layerSelect.addEventListener("change", toggleLayerFields);
mediaSelect.addEventListener("change", toggleMediaFields);
vendorSelect.addEventListener("change", updateRoutingLabel);

parseCircuit(circuitInput.value);
toggleMediaFields();
toggleLayerFields();
updateRoutingLabel();
