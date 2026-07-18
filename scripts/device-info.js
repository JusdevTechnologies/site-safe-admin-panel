const { v4: uuidv4 } = require('uuid');
const db = require('../src/models');
const logger = require('../src/utils/logger');
const NanoMDMService = require('../src/services/mdm/NanoMDMService');
const XMLSerializer = require('../src/services/profile/XMLSerializer');

const UDID = '00008030-00096CE23E85402E';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  // 1. Find device in DB
  const device = await db.MDMDevice.findOne({ where: { udid: UDID } });
  if (!device) {
    console.error('Device not found in DB');
    process.exit(1);
  }

  // 2. Get enrollment from NanoMDM
  const nanoDevice = await NanoMDMService.getDevice(UDID);
  if (!nanoDevice || !nanoDevice.enrollment_id) {
    console.error('No enrollment found');
    process.exit(1);
  }

  // 3. Build DeviceInformation plist
  const commandUuid = uuidv4();
  const commandDict = {
    Command: {
      RequestType: 'DeviceInformation',
      Queries: [
        'OSVersion',
        'IsSupervised',
        'Model',
        'ModelName',
        'ProductName',
        'SerialNumber',
        'UDID',
        'DeviceName',
        'BuildVersion',
        'SupplementalBuildVersion',
        'IsDeviceLocatorServiceEnabled',
        'IsDoNotDisturbInEffect',
        'DeviceCapacity',
        'AvailableDeviceCapacity',
        'PhoneNumber',
        'EthernetMACAddress',
        'WiFiMACAddress',
        'BluetoothMAC',
        'CurrentCarrierNetwork',
        'SIMCarrierNetwork',
        'SubscriberCarrierNetwork',
        'CarrierSettingsVersion',
        'ICCID',
        'MEID',
        'ModemFirmwareVersion',
        'IsActivationLockEnabled',
        'BatteryLevel',
        'IsCloudBackupEnabled',
        'IsMDMLostModeEnabled',
      ],
    },
    CommandUUID: commandUuid,
  };

  const plistXml = XMLSerializer.serialize(commandDict);
  console.log(`Command UUID: ${commandUuid}`);
  console.log(`XML size: ${plistXml.length} bytes`);
  console.log('--- XML ---');
  console.log(plistXml);
  console.log('--- END XML ---');

  // 4. Enqueue command
  console.log(`\nEnqueuing DeviceInformation command...`);
  try {
    await NanoMDMService.enqueueCommand(nanoDevice.enrollment_id, {
      command_payload: plistXml,
    });
    console.log('Command enqueued successfully');
  } catch (err) {
    if (err.details?.responseData?.command_error?.includes('duplicate key')) {
      console.log('Command already queued (duplicate), will send push anyway');
    } else {
      throw err;
    }
  }

  // 5. Send push
  console.log('Sending APNs push...');
  await NanoMDMService.sendPush(nanoDevice.enrollment_id);
  console.log('Push sent');

  // 6. Poll for result (up to 30 seconds)
  console.log('\nWaiting for device to respond...');
  for (let i = 0; i < 15; i++) {
    await sleep(2000);
    try {
      const cmd = await NanoMDMService.getCommand(commandUuid);
      if (cmd) {
        const status = cmd.status || 'unknown';
        console.log(`\nCommand status: ${status}`);
        if (status === 'Acknowledged') {
          console.log('\n=== DEVICE INFORMATION ===');
          console.log(JSON.stringify(cmd, null, 2));
        } else if (status === 'Idle' || status === 'Commanded') {
          console.log('  Still waiting...');
        } else if (status === 'Error' || status === 'NotNow') {
          console.log('\n=== ERROR ===');
          console.log(JSON.stringify(cmd, null, 2));
          break;
        }
        if (status !== 'Idle' && status !== 'Commanded') break;
      } else {
        console.log('  No result yet...');
      }
    } catch (err) {
      console.log(`  Poll error: ${err.message}`);
    }
  }

  // 7. Also try listing recent commands
  console.log('\n\n=== RECENT COMMANDS ===');
  try {
    const listResult = await NanoMDMService.listCommands({
      udid: UDID,
      limit: 5,
    });
    console.log(JSON.stringify(listResult, null, 2));
  } catch (err) {
    console.log(`List error: ${err.message}`);
  }

  await db.sequelize.close();
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
