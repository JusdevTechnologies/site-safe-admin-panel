const db = require('../models');
const logger = require('../utils/logger');
const NotFoundError = require('../exceptions/NotFoundError');
const ConflictError = require('../exceptions/ConflictError');
const { CERTIFICATE_TYPES } = require('../constants');

class ADECertificateService {
  async createCertificate(data) {
    logger.info(`[ADECert] Creating ${data.certificateType} certificate`);

    const existing = await db.CertificateMetadata.findOne({
      where: { uuid: data.uuid },
    });

    if (existing) {
      throw new ConflictError(`Certificate with UUID ${data.uuid} already exists`);
    }

    const cert = await db.CertificateMetadata.create({
      certificate_type: data.certificateType,
      display_name: data.displayName,
      uuid: data.uuid,
      topic: data.topic || null,
      issuer: data.issuer || null,
      subject: data.subject || null,
      serial_number: data.serialNumber || null,
      not_valid_before: data.notValidBefore || null,
      not_valid_after: data.notValidAfter || null,
      thumbprint: data.thumbprint || null,
      is_active: data.isActive !== undefined ? data.isActive : true,
      metadata: data.metadata || null,
    });

    logger.info(`[ADECert] Created certificate ${cert.id}: ${data.uuid}`);
    return this._formatCertificate(cert);
  }

  async updateCertificate(id, data) {
    const cert = await db.CertificateMetadata.findByPk(id);
    if (!cert) {
      throw new NotFoundError(`Certificate ${id} not found`);
    }

    const updates = {};
    if (data.displayName !== undefined) updates.display_name = data.displayName;
    if (data.topic !== undefined) updates.topic = data.topic;
    if (data.issuer !== undefined) updates.issuer = data.issuer;
    if (data.subject !== undefined) updates.subject = data.subject;
    if (data.serialNumber !== undefined) updates.serial_number = data.serialNumber;
    if (data.notValidBefore !== undefined) updates.not_valid_before = data.notValidBefore;
    if (data.notValidAfter !== undefined) updates.not_valid_after = data.notValidAfter;
    if (data.thumbprint !== undefined) updates.thumbprint = data.thumbprint;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    if (Object.keys(updates).length > 0) {
      await cert.update(updates);
      logger.info(`[ADECert] Updated certificate ${id}`);
    }

    return this._formatCertificate(cert);
  }

  async getCertificate(id) {
    const cert = await db.CertificateMetadata.findByPk(id);
    if (!cert) {
      throw new NotFoundError(`Certificate ${id} not found`);
    }
    return this._formatCertificate(cert);
  }

  async getAllCertificates(filters = {}) {
    const { page = 1, limit = 10, certificateType, isActive } = filters;
    const where = {};
    if (certificateType) where.certificate_type = certificateType;
    if (isActive !== undefined) where.is_active = isActive;

    const offset = (page - 1) * limit;
    const { count, rows } = await db.CertificateMetadata.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows.map((c) => this._formatCertificate(c)),
      total: count,
      page,
      limit,
    };
  }

  async deleteCertificate(id) {
    const cert = await db.CertificateMetadata.findByPk(id);
    if (!cert) {
      throw new NotFoundError(`Certificate ${id} not found`);
    }
    await cert.destroy();
    logger.info(`[ADECert] Deleted certificate ${id}`);
    return { id };
  }

  async getActiveIdentityCertificate() {
    return db.CertificateMetadata.findOne({
      where: { certificate_type: CERTIFICATE_TYPES.IDENTITY, is_active: true },
    });
  }

  async getActivePushCertificate() {
    return db.CertificateMetadata.findOne({
      where: { certificate_type: CERTIFICATE_TYPES.PUSH, is_active: true },
    });
  }

  async getAnchorCertificates() {
    return db.CertificateMetadata.findAll({
      where: { certificate_type: CERTIFICATE_TYPES.ANCHOR, is_active: true },
    });
  }

  _formatCertificate(cert) {
    return {
      id: cert.id,
      certificateType: cert.certificate_type,
      displayName: cert.display_name,
      uuid: cert.uuid,
      topic: cert.topic,
      issuer: cert.issuer,
      subject: cert.subject,
      serialNumber: cert.serial_number,
      notValidBefore: cert.not_valid_before,
      notValidAfter: cert.not_valid_after,
      thumbprint: cert.thumbprint,
      isActive: cert.is_active,
      metadata: cert.metadata,
      createdAt: cert.created_at,
      updatedAt: cert.updated_at,
    };
  }
}

module.exports = new ADECertificateService();
