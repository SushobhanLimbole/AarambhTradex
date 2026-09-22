import SymbolMetadataModel from "../models/symbolMetadata.model.js";

/**
 * Controller for Symbols Metadata CRUD and High-Speed Filters
 */

/**
 * GET /api/symbols/meta
 * High-speed retrieval of available exchanges, indices, and summary metadata
 */
export const getSymbolsMeta = async (req, res, next) => {
  try {
    const meta = await SymbolMetadataModel.getFilters();
    return res.status(200).json({
      success: true,
      data: meta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/symbols
 * Retrieve symbols with filtering by exchange, indice, or search query
 */
export const getAllSymbols = async (req, res, next) => {
  try {
    const { exchange, indice, search, limit, offset, order } = req.query;

    const data = await SymbolMetadataModel.findAll({
      exchange,
      indice,
      search,
      limit: limit === "all" || limit === "ALL" ? undefined : limit,
      offset: offset ? Number(offset) : 0,
      order,
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/symbols/:id
 * Retrieve single symbol metadata by ID or Symbol
 */
export const getSymbolById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let record = null;
    if (!isNaN(Number(id))) {
      record = await SymbolMetadataModel.findById(Number(id));
    }
    if (!record) {
      record = await SymbolMetadataModel.findBySymbol(id);
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: `Symbol record '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/symbols
 * Create a new symbol metadata record
 */
export const createSymbol = async (req, res, next) => {
  try {
    const { symbol, exchange, indice, company_name } = req.body;

    if (!symbol || symbol.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Field 'symbol' is required",
      });
    }

    const existing = await SymbolMetadataModel.findBySymbol(symbol.trim().toUpperCase());
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Symbol '${symbol}' already exists`,
        data: existing,
      });
    }

    const newRecord = await SymbolMetadataModel.create({
      symbol,
      exchange,
      indice,
      company_name,
    });

    return res.status(201).json({
      success: true,
      message: "Symbol metadata created successfully",
      data: newRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/symbols/:id
 * Update an existing symbol metadata record
 */
export const updateSymbol = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await SymbolMetadataModel.findById(Number(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Symbol with ID '${id}' not found`,
      });
    }

    const updated = await SymbolMetadataModel.update(Number(id), updateData);

    return res.status(200).json({
      success: true,
      message: "Symbol metadata updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/symbols/:id
 * Delete a symbol metadata record
 */
export const deleteSymbol = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await SymbolMetadataModel.findById(Number(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Symbol with ID '${id}' not found`,
      });
    }

    await SymbolMetadataModel.delete(Number(id));

    return res.status(200).json({
      success: true,
      message: `Symbol '${existing.symbol}' deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};
