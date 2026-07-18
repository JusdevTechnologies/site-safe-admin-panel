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
  const device = await db.MDMDevice.findOne({ where: { udid: UDID } });
  if (!device) {
    console.error('Device not found in DB');
    process.exit(1);
  }

  const nanoDevice = await NanoMDMService.getDevice(UDID);
  if (!nanoDevice || !nanoDevice.enrollment_id) {
    console.error('No enrollment found');
    process.exit(1);
  }

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

  console.log(`\nEnqueuing DeviceInformation command...`);
  try {
    await NanoMDMService.enqueueCommand(nanoDevice.enrollment_id, {
      command_payload: plistXml,
    });
    console.log('Command enqueued');
  } catch (err) {
    if (err.details?.responseData?.command_error?.includes('duplicate key')) {
      console.log('Already queued (dup), proceeding to push');
    } else {
      throw err;
    }
  }

  console.log('Sending APNs push...');
  await NanoMDMService.sendPush(nanoDevice.enrollment_id);
  console.log('Push sent');

  console.log('\nWaiting 30s for device to respond...');
  await sleep(30000);

  console.log('\n=== COMMANDS LIST ===');
  try {
    const list = await NanoMDMService.listCommands({ udid: UDID, limit: 10 });
    console.log(JSON.stringify(list, null, 2));
  } catch (err) {
    console.log(`List error: ${err.message}`);
  }

  console.log('\n=== DEVICE INFO FROM DB ===');
  const refreshed = await db.MDMDevice.findOne({ where: { udid: UDID } });
  if (refreshed && refreshed.device_info) {
    console.log(JSON.stringify(refreshed.device_info, null, 2));
  } else {
    console.log('No device_info in site_safe_db');
  }

  await db.sequelize.close();
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
